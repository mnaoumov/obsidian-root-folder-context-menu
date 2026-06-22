import type { FileExplorerPlugin } from '@obsidian-typings/obsidian-public-latest';
import type {
  App as AppType,
  EventRef,
  Menu,
  MenuItem as MenuItemType,
  PluginManifest,
  TFolder as TFolderType
} from 'obsidian';

import {
  sleep,
  waitForAllAsyncOperations
} from 'obsidian-dev-utils/async';
import { noop } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import {
  App,
  MenuItem,
  TFolder
} from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { Plugin } from './plugin.ts';

const PLUGIN_ID = 'root-folder-context-menu';
const STRICT_PROXY_TARGET_SYMBOL = Symbol.for('strictProxyTarget');

interface AppGlobal {
  app: AppType;
}

interface FileExplorerLeafLike {
  loadIfDeferred(): Promise<void>;
  view: FileExplorerViewLike;
}

interface FileExplorerPluginInstanceLike {
  plugin: FileExplorerPlugin;
}

interface FileExplorerViewLike {
  files: Map<unknown, unknown>;
  openFileContextMenu(event: Event, fileItemElement: HTMLElement): void;
}

interface FileItemElements {
  fileItemElement: HTMLElement;
  parentElement: HTMLElement;
}

interface FileLike {
  path: string;
}

interface LoadedFlagHolder {
  loaded__: boolean;
}

interface MenuItemWithTitle {
  titleEl: TitleElement;
}

interface PluginPrivate {
  fileExplorerView?: FileExplorerViewLike;
  handleFileMenuEvent(menu: Menu, file: FileLike): void;
  onLayoutReady(): Promise<void>;
  openContextMenu(ev: Event, vaultSwitcherEl: HTMLElement): Promise<void>;
  openFileContextMenu(next: (event: Event, fileItemElement: HTMLElement) => void, view: FileExplorerViewLike, event: Event, fileItemElement: HTMLElement): void;
}

interface TitleElement {
  textContent: string;
}

const manifest = castTo<PluginManifest>({ id: PLUGIN_ID });

let app: AppType;
let appMock: App;
let savedGlobalApp: AppType;
let capturedLayoutReadyCallback: (() => void) | undefined;
let disablePluginMock: ReturnType<typeof vi.fn>;
let getEnabledPluginByIdMock: ReturnType<typeof vi.fn>;
let getLeavesOfTypeMock: ReturnType<typeof vi.fn>;
let workspaceOnMock: ReturnType<typeof vi.fn>;

describe('Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedLayoutReadyCallback = undefined;
    appMock = App.createConfigured__();
    app = appMock.asOriginalType__();

    // The real PluginBase children read dev-utils state off the app (and the global app).
    seedOnRawTarget(app, 'obsidianDevUtilsState', {});

    disablePluginMock = vi.fn().mockResolvedValue(undefined);
    getEnabledPluginByIdMock = vi.fn();
    getLeavesOfTypeMock = vi.fn().mockReturnValue([]);
    workspaceOnMock = vi.fn().mockReturnValue(castTo<EventRef>({}));

    seedOnRawTarget(app, 'internalPlugins', { getEnabledPluginById: getEnabledPluginByIdMock });
    seedOnRawTarget(app, 'plugins', { disablePlugin: disablePluginMock });
    seedOnRawTarget(app.workspace, 'getLeavesOfType', getLeavesOfTypeMock);
    seedOnRawTarget(app.workspace, 'on', workspaceOnMock);
    seedOnRawTarget(app.workspace, 'onLayoutReady', (callback: () => void) => {
      capturedLayoutReadyCallback = callback;
    });

    savedGlobalApp = castTo<AppGlobal>(window).app;
    castTo<AppGlobal>(window).app = app;
  });

  afterEach(() => {
    castTo<AppGlobal>(window).app = savedGlobalApp;
    while (activeDocument.body.firstChild) {
      activeDocument.body.firstChild.remove();
    }
  });

  describe('onLayoutReady', () => {
    it('should disable the plugin when the File Explorer plugin is disabled', async () => {
      getEnabledPluginByIdMock.mockReturnValue(null);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(noop);

      const plugin = await createLoadedPlugin();
      await fireLayoutReady();
      await unloadPlugin(plugin);

      expect(consoleErrorSpy).toHaveBeenCalledWith('File Explorer plugin is disabled. Disabling the plugin...');
      expect(disablePluginMock).toHaveBeenCalledWith(PLUGIN_ID);
    });

    it('should disable the plugin when the File Explorer view cannot be initialized', async () => {
      const leaf = createLeaf();
      leaf.loadIfDeferred = vi.fn().mockRejectedValue(new Error('boom'));
      getEnabledPluginByIdMock.mockReturnValue(createFileExplorerPluginInstance());
      getLeavesOfTypeMock.mockReturnValue([leaf]);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(noop);

      const plugin = await createLoadedPlugin();
      await fireLayoutReady();
      await unloadPlugin(plugin);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(disablePluginMock).toHaveBeenCalledWith(PLUGIN_ID);
    });

    it('should patch openFileContextMenu and reload the file explorer when the view is available', async () => {
      const view = createFileExplorerView();
      const originalOpenFileContextMenu = view.openFileContextMenu;
      const leaf = createLeaf(view);
      const fileExplorerPlugin = createFileExplorerPlugin();
      getEnabledPluginByIdMock.mockReturnValue({ plugin: fileExplorerPlugin });
      getLeavesOfTypeMock.mockReturnValue([leaf]);

      const plugin = await createLoadedPlugin();
      await fireLayoutReady();

      // The real MonkeyAroundComponent replaced the prototype method with the plugin's wrapper.
      expect(view.openFileContextMenu).not.toBe(originalOpenFileContextMenu);
      expect(fileExplorerPlugin.disable).toHaveBeenCalled();
      expect(fileExplorerPlugin.enable).toHaveBeenCalled();
      expect(workspaceOnMock).toHaveBeenCalledWith('file-menu', expect.any(Function));

      await unloadPlugin(plugin);
    });

    it('should retry initializing the view until a file explorer leaf becomes available', async () => {
      const view = createFileExplorerView();
      const originalOpenFileContextMenu = view.openFileContextMenu;
      const leaf = createLeaf(view);
      getEnabledPluginByIdMock.mockReturnValue({ plugin: createFileExplorerPlugin() });
      // The first lookup finds no leaf (operationFn returns false), so retryWithTimeout retries.
      getLeavesOfTypeMock.mockReturnValueOnce([]).mockReturnValue([leaf]);

      const plugin = await createLoadedPlugin();
      // Draining the tracked onLayoutReady promise waits for retryWithTimeout's real retry loop to complete.
      await fireLayoutReady();

      expect(getLeavesOfTypeMock.mock.calls.length).toBeGreaterThan(1);
      // The retry eventually resolved the view, so the prototype patch was installed.
      expect(view.openFileContextMenu).not.toBe(originalOpenFileContextMenu);

      await unloadPlugin(plugin);
    });

    it('should wire the vault switcher and nav files container context menus when present', async () => {
      const view = createFileExplorerView();
      const leaf = createLeaf(view);
      getEnabledPluginByIdMock.mockReturnValue({ plugin: createFileExplorerPlugin() });
      getLeavesOfTypeMock.mockReturnValue([leaf]);

      const vaultSwitcherEl = appendElement('workspace-drawer-vault-switcher');
      const navFilesContainerEl = appendElement('nav-files-container');

      const plugin = await createLoadedPlugin();
      await fireLayoutReady();

      expect(view.files.get(vaultSwitcherEl)).toBe(app.vault.getRoot());
      expect(navFilesContainerEl).toBeInstanceOf(HTMLElement);

      await unloadPlugin(plugin);
    });

    it('should wire only the vault switcher when the nav files container is absent', async () => {
      const view = createFileExplorerView();
      const leaf = createLeaf(view);
      getEnabledPluginByIdMock.mockReturnValue({ plugin: createFileExplorerPlugin() });
      getLeavesOfTypeMock.mockReturnValue([leaf]);

      const vaultSwitcherEl = appendElement('workspace-drawer-vault-switcher');

      const plugin = await createLoadedPlugin();
      await fireLayoutReady();

      expect(view.files.get(vaultSwitcherEl)).toBe(app.vault.getRoot());

      await unloadPlugin(plugin);
    });
  });

  describe('handleFileMenuEvent', () => {
    it('should not filter menu items for non-root files', async () => {
      const plugin = await createLoadedPlugin();
      const item = createMenuItem('Some action');
      const menu = castTo<Menu>({ items: [item] });

      castTo<PluginPrivate>(plugin).handleFileMenuEvent(menu, { path: 'some/path' });

      expect(menu.items).toHaveLength(1);
      await unloadPlugin(plugin);
    });

    it('should filter root-specific menu items for the root folder', async () => {
      stubI18Next();
      const plugin = await createLoadedPlugin();
      const rootItem = createMenuItem('translated-plugins.file-explorer.menu-opt-rename');
      const otherItem = createMenuItem('Some other action');
      const menu = castTo<Menu>({ items: [rootItem, otherItem] });

      castTo<PluginPrivate>(plugin).handleFileMenuEvent(menu, { path: '/' });

      expect(menu.items).toHaveLength(1);
      expect(menu.items[0]).toBe(otherItem);
      vi.unstubAllGlobals();
      await unloadPlugin(plugin);
    });

    it('should keep non-MenuItem entries in the menu for the root folder', async () => {
      stubI18Next();
      const plugin = await createLoadedPlugin();
      const nonMenuItemEntry = castTo<MenuItemType>({ titleEl: { textContent: 'translated-plugins.file-explorer.menu-opt-rename' } });
      const menu = castTo<Menu>({ items: [nonMenuItemEntry] });

      castTo<PluginPrivate>(plugin).handleFileMenuEvent(menu, { path: '/' });

      expect(menu.items).toHaveLength(1);
      vi.unstubAllGlobals();
      await unloadPlugin(plugin);
    });
  });

  describe('openFileContextMenu', () => {
    it('should return early when the parent element is not an HTMLElement', async () => {
      const plugin = await createLoadedPlugin();
      const next = vi.fn();
      const view = createFileExplorerView();
      const fileItemElement = activeDocument.createElement('div');

      castTo<PluginPrivate>(plugin).openFileContextMenu(next, view, new Event('contextmenu'), fileItemElement);

      expect(next).not.toHaveBeenCalled();
      await unloadPlugin(plugin);
    });

    it('should call next directly for non-folder files', async () => {
      const plugin = await createLoadedPlugin();
      const next = vi.fn();
      const { fileItemElement, parentElement } = createFileItemElements();
      const view = createFileExplorerView();
      view.files.set(parentElement, { path: 'test.md' });
      const event = new Event('contextmenu');

      castTo<PluginPrivate>(plugin).openFileContextMenu(next, view, event, fileItemElement);

      expect(next).toHaveBeenCalledWith(event, fileItemElement);
      await unloadPlugin(plugin);
    });

    it('should call next directly for non-root folders', async () => {
      const plugin = await createLoadedPlugin();
      const next = vi.fn();
      const { fileItemElement, parentElement } = createFileItemElements();
      const view = createFileExplorerView();
      view.files.set(parentElement, TFolder.create__(appMock.vault, 'some-folder'));
      const event = new Event('contextmenu');

      castTo<PluginPrivate>(plugin).openFileContextMenu(next, view, event, fileItemElement);

      expect(next).toHaveBeenCalledWith(event, fileItemElement);
      await unloadPlugin(plugin);
    });

    it('should temporarily report the root folder as non-root while calling next', async () => {
      const plugin = await createLoadedPlugin();
      const next = vi.fn();
      const { fileItemElement, parentElement } = createFileItemElements();
      const rootFolder = castTo<TFolderType>(app.vault.getRoot());
      const view = createFileExplorerView();
      view.files.set(parentElement, rootFolder);

      let isRootDuringNext: boolean | undefined;
      next.mockImplementation(() => {
        isRootDuringNext = rootFolder.isRoot();
      });

      castTo<PluginPrivate>(plugin).openFileContextMenu(next, view, new Event('contextmenu'), fileItemElement);

      expect(isRootDuringNext).toBe(false);
      expect(rootFolder.isRoot()).toBe(true);
      await unloadPlugin(plugin);
    });
  });

  describe('openContextMenu', () => {
    it('should click the body and open the context menu after the delay', async () => {
      vi.stubGlobal('sleep', vi.fn().mockResolvedValue(undefined));
      const bodyClickSpy = vi.spyOn(activeDocument.body, 'click');
      const plugin = await createLoadedPlugin();

      const openFileContextMenuMock = vi.fn();
      const childNode = activeDocument.createElement('span');
      const vaultSwitcherEl = activeDocument.createElement('div');
      vaultSwitcherEl.appendChild(childNode);
      castTo<PluginPrivate>(plugin).fileExplorerView = castTo<FileExplorerViewLike>({ openFileContextMenu: openFileContextMenuMock });

      const event = new Event('contextmenu');
      await castTo<PluginPrivate>(plugin).openContextMenu(event, vaultSwitcherEl);

      expect(bodyClickSpy).toHaveBeenCalled();
      expect(openFileContextMenuMock).toHaveBeenCalledWith(event, childNode);

      vi.unstubAllGlobals();
      await unloadPlugin(plugin);
    });
  });
});

function appendElement(className: string): HTMLElement {
  const element = activeDocument.createElement('div');
  element.className = className;
  activeDocument.body.appendChild(element);
  return element;
}

function createFileExplorerPlugin(): FileExplorerPlugin {
  return castTo<FileExplorerPlugin>({
    disable: vi.fn(),
    enable: vi.fn().mockResolvedValue(undefined)
  });
}

function createFileExplorerPluginInstance(): FileExplorerPluginInstanceLike {
  return { plugin: createFileExplorerPlugin() };
}

function createFileExplorerView(): FileExplorerViewLike {
  // A dedicated class gives the view its own prototype.
  // The real MonkeyAroundComponent then patches that prototype instead of Object.prototype.
  class FakeFileExplorerView {
    public files = new Map();
    public openFileContextMenu(_event: Event, _fileItemElement: HTMLElement): void {
      noop();
    }
  }
  return new FakeFileExplorerView();
}

function createFileItemElements(): FileItemElements {
  const parentElement = activeDocument.createElement('div');
  const fileItemElement = activeDocument.createElement('div');
  parentElement.appendChild(fileItemElement);
  return { fileItemElement, parentElement };
}

function createLeaf(view = createFileExplorerView()): FileExplorerLeafLike {
  return {
    loadIfDeferred: vi.fn().mockResolvedValue(undefined),
    view
  };
}

async function createLoadedPlugin(): Promise<Plugin> {
  const plugin = new Plugin(app, manifest);
  // PluginBase.onload is async; driving it directly runs onloadImpl and eager-loads the real children.
  await plugin.onload();
  return plugin;
}

function createMenuItem(textContent: string): MenuItemType {
  const item = castTo<MenuItemWithTitle>(MenuItem.create__(castTo<Menu>({})));
  item.titleEl = { textContent };
  return castTo<MenuItemType>(item);
}

async function fireLayoutReady(): Promise<void> {
  if (!capturedLayoutReadyCallback) {
    throw new Error('Layout-ready callback was not captured.');
  }
  // CallbackLayoutReadyComponent.onload registers this callback; it schedules a setTimeout(0) that invokes onLayoutReady via the real invokeAsyncSafely.
  capturedLayoutReadyCallback();
  await settleAsyncOperations();
}

function seedOnRawTarget(strictProxiedObject: object, key: string, value: unknown): void {
  const rawTarget = castTo<object | undefined>(Reflect.get(strictProxiedObject, STRICT_PROXY_TARGET_SYMBOL)) ?? strictProxiedObject;
  Reflect.set(rawTarget, key, value);
}

async function settleAsyncOperations(): Promise<void> {
  // The LayoutReadyComponent guard (window.setTimeout(0)) is a plain timer, so let it fire to schedule onLayoutReady via the real invokeAsyncSafely.
  await sleep(0);
  // Async-operation tracking then drains the tracked onLayoutReady promise (including its internal retryWithTimeout retries) deterministically.
  await waitForAllAsyncOperations();
}

function stubI18Next(): void {
  vi.stubGlobal('activeWindow', {
    i18next: {
      t: (key: string): string => `translated-${key}`
    }
  });
}

async function unloadPlugin(plugin: Plugin): Promise<void> {
  // The onload() lifecycle was driven directly (not load()).
  // Flip the real loaded flag so unload() flushes registered cleanups and removes the prototype patch.
  castTo<LoadedFlagHolder>(plugin).loaded__ = true;
  plugin.unload();
  await settleAsyncOperations();
}
