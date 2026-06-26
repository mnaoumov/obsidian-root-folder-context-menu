import type { FileExplorerPlugin } from '@obsidian-typings/obsidian-public-latest';
import type {
  App as AppType,
  EventRef,
  Menu,
  MenuItem as MenuItemType
} from 'obsidian';

import {
  sleep,
  waitForAllAsyncOperations
} from 'obsidian-dev-utils/async';
import { noop } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { ConsoleDebugComponent } from 'obsidian-dev-utils/obsidian/components/console-debug-component';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  App,
  MenuItem
} from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { Plugin } from './plugin.ts';

import { RootFolderContextMenuComponent } from './root-folder-context-menu-component.ts';

const PLUGIN_ID = 'root-folder-context-menu';
const STRICT_PROXY_TARGET_SYMBOL = Symbol.for('strictProxyTarget');

interface AppGlobal {
  app: AppType;
}

interface ComponentPrivate {
  fileExplorerView?: FileExplorerViewLike;
  handleFileMenuEvent(menu: Menu, file: FileLike): void;
  openContextMenu(ev: Event, vaultSwitcherEl: HTMLElement): Promise<void>;
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

interface FileLike {
  path: string;
}

interface MenuItemWithTitle {
  titleEl: TitleElement;
}

interface TitleElement {
  textContent: string;
}

let app: AppType;
let appMock: App;
let savedGlobalApp: AppType;
let capturedLayoutReadyCallback: (() => void) | undefined;
let disablePluginMock: ReturnType<typeof vi.fn>;
let getEnabledPluginByIdMock: ReturnType<typeof vi.fn>;
let getLeavesOfTypeMock: ReturnType<typeof vi.fn>;
let workspaceOnMock: ReturnType<typeof vi.fn>;

describe('RootFolderContextMenuComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedLayoutReadyCallback = undefined;
    appMock = App.createConfigured__();
    app = appMock.asOriginalType__();

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

      const component = createLoadedComponent();
      await fireLayoutReady();
      await unloadComponent(component);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('File Explorer plugin is disabled. Disabling the plugin...'));
      expect(disablePluginMock).toHaveBeenCalledWith(PLUGIN_ID);
    });

    it('should disable the plugin when the File Explorer view cannot be initialized', async () => {
      const leaf = createLeaf();
      leaf.loadIfDeferred = vi.fn().mockRejectedValue(new Error('boom'));
      getEnabledPluginByIdMock.mockReturnValue(createFileExplorerPluginInstance());
      getLeavesOfTypeMock.mockReturnValue([leaf]);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(noop);

      const component = createLoadedComponent();
      await fireLayoutReady();
      await unloadComponent(component);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Could not initialize FileExplorerView. Disabling the plugin...'));
      expect(disablePluginMock).toHaveBeenCalledWith(PLUGIN_ID);
    });

    it('should patch openFileContextMenu and reload the file explorer when the view is available', async () => {
      const view = createFileExplorerView();
      const originalOpenFileContextMenu = view.openFileContextMenu;
      const leaf = createLeaf(view);
      const fileExplorerPlugin = createFileExplorerPlugin();
      getEnabledPluginByIdMock.mockReturnValue({ plugin: fileExplorerPlugin });
      getLeavesOfTypeMock.mockReturnValue([leaf]);

      const component = createLoadedComponent();
      await fireLayoutReady();

      // The real MonkeyAroundComponent (inside the patch child) replaced the prototype method.
      expect(view.openFileContextMenu).not.toBe(originalOpenFileContextMenu);
      expect(fileExplorerPlugin.disable).toHaveBeenCalled();
      expect(fileExplorerPlugin.enable).toHaveBeenCalled();
      expect(workspaceOnMock).toHaveBeenCalledWith('file-menu', expect.any(Function));

      await unloadComponent(component);
    });

    it('should retry initializing the view until a file explorer leaf becomes available', async () => {
      const view = createFileExplorerView();
      const originalOpenFileContextMenu = view.openFileContextMenu;
      const leaf = createLeaf(view);
      getEnabledPluginByIdMock.mockReturnValue({ plugin: createFileExplorerPlugin() });
      // The first lookup finds no leaf (operationFn returns false), so retryWithTimeout retries.
      getLeavesOfTypeMock.mockReturnValueOnce([]).mockReturnValue([leaf]);

      const component = createLoadedComponent();
      await fireLayoutReady();

      expect(getLeavesOfTypeMock.mock.calls.length).toBeGreaterThan(1);
      expect(view.openFileContextMenu).not.toBe(originalOpenFileContextMenu);

      await unloadComponent(component);
    });

    it('should wire the vault switcher and nav files container context menus when present', async () => {
      const view = createFileExplorerView();
      const leaf = createLeaf(view);
      getEnabledPluginByIdMock.mockReturnValue({ plugin: createFileExplorerPlugin() });
      getLeavesOfTypeMock.mockReturnValue([leaf]);

      const vaultSwitcherEl = appendElement('workspace-drawer-vault-switcher');
      const navFilesContainerEl = appendElement('nav-files-container');

      const component = createLoadedComponent();
      await fireLayoutReady();

      expect(view.files.get(vaultSwitcherEl)).toBe(app.vault.getRoot());
      expect(navFilesContainerEl).toBeInstanceOf(HTMLElement);

      await unloadComponent(component);
    });

    it('should wire only the vault switcher when the nav files container is absent', async () => {
      const view = createFileExplorerView();
      const leaf = createLeaf(view);
      getEnabledPluginByIdMock.mockReturnValue({ plugin: createFileExplorerPlugin() });
      getLeavesOfTypeMock.mockReturnValue([leaf]);

      const vaultSwitcherEl = appendElement('workspace-drawer-vault-switcher');

      const component = createLoadedComponent();
      await fireLayoutReady();

      expect(view.files.get(vaultSwitcherEl)).toBe(app.vault.getRoot());

      await unloadComponent(component);
    });
  });

  describe('handleFileMenuEvent', () => {
    it('should not filter menu items for non-root files', async () => {
      const component = createLoadedComponent();
      const item = createMenuItem('Some action');
      const menu = castTo<Menu>({ items: [item] });

      castTo<ComponentPrivate>(component).handleFileMenuEvent(menu, { path: 'some/path' });

      expect(menu.items).toHaveLength(1);
      await unloadComponent(component);
    });

    it('should filter root-specific menu items for the root folder', async () => {
      stubI18Next();
      const component = createLoadedComponent();
      const rootItem = createMenuItem('translated-plugins.file-explorer.menu-opt-rename');
      const otherItem = createMenuItem('Some other action');
      const menu = castTo<Menu>({ items: [rootItem, otherItem] });

      castTo<ComponentPrivate>(component).handleFileMenuEvent(menu, { path: '/' });

      expect(menu.items).toHaveLength(1);
      expect(menu.items[0]).toBe(otherItem);
      vi.unstubAllGlobals();
      await unloadComponent(component);
    });

    it('should keep non-MenuItem entries in the menu for the root folder', async () => {
      stubI18Next();
      const component = createLoadedComponent();
      const nonMenuItemEntry = castTo<MenuItemType>({ titleEl: { textContent: 'translated-plugins.file-explorer.menu-opt-rename' } });
      const menu = castTo<Menu>({ items: [nonMenuItemEntry] });

      castTo<ComponentPrivate>(component).handleFileMenuEvent(menu, { path: '/' });

      expect(menu.items).toHaveLength(1);
      vi.unstubAllGlobals();
      await unloadComponent(component);
    });
  });

  describe('openContextMenu', () => {
    it('should click the body and open the context menu after the delay', async () => {
      vi.stubGlobal('sleep', vi.fn().mockResolvedValue(undefined));
      const bodyClickSpy = vi.spyOn(activeDocument.body, 'click');
      const component = createLoadedComponent();

      const openFileContextMenuMock = vi.fn();
      const childNode = activeDocument.createElement('span');
      const vaultSwitcherEl = activeDocument.createElement('div');
      vaultSwitcherEl.appendChild(childNode);
      castTo<ComponentPrivate>(component).fileExplorerView = castTo<FileExplorerViewLike>({ openFileContextMenu: openFileContextMenuMock });

      const event = new Event('contextmenu');
      await castTo<ComponentPrivate>(component).openContextMenu(event, vaultSwitcherEl);

      expect(bodyClickSpy).toHaveBeenCalled();
      expect(openFileContextMenuMock).toHaveBeenCalledWith(event, childNode);

      vi.unstubAllGlobals();
      await unloadComponent(component);
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

function createLeaf(view = createFileExplorerView()): FileExplorerLeafLike {
  return {
    loadIfDeferred: vi.fn().mockResolvedValue(undefined),
    view
  };
}

function createLoadedComponent(): RootFolderContextMenuComponent {
  const consoleDebugComponent = new ConsoleDebugComponent(PLUGIN_ID);
  const component = new RootFolderContextMenuComponent({
    app,
    consoleDebugComponent,
    plugin: createPluginMock()
  });
  // The real Component.load() flips loaded__/_loaded and runs onload(), which registers the layout-ready handler.
  component.load();
  return component;
}

function createMenuItem(textContent: string): MenuItemType {
  const item = castTo<MenuItemWithTitle>(MenuItem.create__(castTo<Menu>({})));
  item.titleEl = { textContent };
  return castTo<MenuItemType>(item);
}

function createPluginMock(): Plugin {
  return strictProxy<Plugin>({
    app,
    manifest: castTo<Plugin['manifest']>({ id: PLUGIN_ID })
  });
}

async function fireLayoutReady(): Promise<void> {
  if (!capturedLayoutReadyCallback) {
    throw new Error('Layout-ready callback was not captured.');
  }
  // LayoutReadyComponent.onload registers this callback; it schedules a setTimeout(0) that invokes onLayoutReady via the real invokeAsyncSafely.
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

async function unloadComponent(component: RootFolderContextMenuComponent): Promise<void> {
  component.unload();
  await settleAsyncOperations();
}
