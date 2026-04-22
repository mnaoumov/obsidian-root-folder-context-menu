import type { RegisterComponentParams } from 'obsidian-dev-utils/obsidian/plugin/plugin';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

interface DomEventHandlerEntry {
  element: unknown;
  event: string;
  handler: (...args: unknown[]) => unknown;
}

interface MockApp {
  internalPlugins: MockInternalPlugins;
  plugins: MockPlugins;
  vault: MockVault;
  workspace: MockWorkspace;
}

interface MockFileExplorerPlugin {
  disable: ReturnType<typeof vi.fn>;
  enable: ReturnType<typeof vi.fn>;
}

interface MockInternalPlugins {
  getEnabledPluginById: ReturnType<typeof vi.fn>;
}

interface MockPlugins {
  disablePlugin: ReturnType<typeof vi.fn>;
}

interface MockVault {
  getRoot: () => unknown;
}

interface MockWorkspace {
  getLeavesOfType: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}

interface PluginPrivateMethods {
  handleFileMenuEvent: (menu: unknown, file: unknown) => void;
  initFileExplorerView: () => Promise<void>;
  onLayoutReady: () => Promise<void>;
  openContextMenu: (ev: unknown, el: unknown) => Promise<void>;
  openFileContextMenu: (next: unknown, view: unknown, event: unknown, el: unknown) => void;
  reloadFileExplorer: () => Promise<void>;
}

interface RetryParams {
  operationFn: (abortSignal: AbortSignal) => boolean | PromiseLike<boolean>;
}

const PluginBaseMock = vi.hoisted(() =>
  class {
    public app: unknown;
    public consoleDebugComponent = { debug: vi.fn() };
    public manifest: unknown;
    private readonly domEventHandlers: DomEventHandlerEntry[] = [];
    private readonly eventHandlers: unknown[] = [];
    private readonly registeredComponents: RegisterComponentParams[] = [];
    private readonly unloadCallbacks: (() => unknown)[] = [];

    public constructor(app: unknown, manifest: unknown) {
      this.app = app;
      this.manifest = manifest;
    }

    public register(callback: () => unknown): void {
      this.unloadCallbacks.push(callback);
    }

    public registerComponent(params: RegisterComponentParams): unknown {
      this.registeredComponents.push(params);
      return params.component;
    }

    public registerDomEvent(element: unknown, event: string, handler: (...args: unknown[]) => unknown): void {
      this.domEventHandlers.push({ element, event, handler });
    }

    public registerEvent(ref: unknown): void {
      this.eventHandlers.push(ref);
    }
  }
);

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin', () => ({
  PluginBase: PluginBaseMock
}));

vi.mock('obsidian-dev-utils/async', () => ({
  convertAsyncToSync: (fn: (...args: unknown[]) => Promise<unknown>): typeof fn => fn,
  retryWithTimeout: vi.fn()
}));

vi.mock('obsidian-dev-utils/object-utils', () => ({
  getPrototypeOf: vi.fn((obj: unknown) => Object.getPrototypeOf(obj as object))
}));

vi.mock('obsidian-dev-utils/obsidian/monkey-around', () => ({
  registerPatch: vi.fn()
}));

vi.mock('obsidian-typings/implementations', () => ({
  InternalPluginName: {
    FileExplorer: 'file-explorer'
  }
}));

vi.mock('obsidian', () => {
  class MockMenu {
    public items: unknown[] = [];
  }
  class MockMenuItem {
    public titleEl = { textContent: '' };
  }
  class MockTAbstractFile {
    public path = '';
  }
  class MockTFolder extends MockTAbstractFile {
    public isRoot(): boolean {
      return false;
    }
  }
  return {
    Menu: MockMenu,
    MenuItem: MockMenuItem,
    Notice: vi.fn(),
    TAbstractFile: MockTAbstractFile,
    TFolder: MockTFolder
  };
});

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import {
  MenuItem,
  TFolder
} from 'obsidian';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { retryWithTimeout } from 'obsidian-dev-utils/async';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { registerPatch } from 'obsidian-dev-utils/obsidian/monkey-around';

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

// eslint-disable-next-line no-restricted-syntax -- Mocked class with public constructor needs double assertion.
const MenuItemConstructor = MenuItem as unknown as new () => MenuItem;

function asPrivate(p: Plugin): PluginPrivateMethods {
  // eslint-disable-next-line no-restricted-syntax -- Accessing private methods for testing needs double assertion.
  return p as unknown as PluginPrivateMethods;
}

function createMenuItem(): MenuItem {
  return new MenuItemConstructor();
}

function createMockApp(): MockApp {
  return {
    internalPlugins: {
      getEnabledPluginById: vi.fn()
    },
    plugins: {
      disablePlugin: vi.fn().mockResolvedValue(undefined)
    },
    vault: {
      getRoot: vi.fn().mockReturnValue({ path: '/' })
    },
    workspace: {
      getLeavesOfType: vi.fn().mockReturnValue([]),
      on: vi.fn().mockReturnValue({ id: 'event-ref' })
    }
  };
}

function createMockFileExplorerPlugin(): MockFileExplorerPlugin {
  return {
    disable: vi.fn(),
    enable: vi.fn().mockResolvedValue(undefined)
  };
}

function setupRetryWithTimeoutToResolveLeaf(workspace: MockWorkspace, mockLeaf: unknown): void {
  const mockRetryWithTimeout = vi.mocked(retryWithTimeout);
  mockRetryWithTimeout.mockImplementation(async (params: RetryParams) => {
    workspace.getLeavesOfType.mockReturnValue([mockLeaf]);
    await params.operationFn(new AbortController().signal);
  });
}

describe('Plugin', () => {
  let plugin: Plugin;
  let mockApp: MockApp;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApp = createMockApp();
    plugin = new Plugin(mockApp as never, { id: 'root-folder-context-menu' } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extend PluginBase', () => {
    expect(plugin).toBeInstanceOf(PluginBaseMock);
  });

  describe('onLayoutReady', () => {
    it('should disable plugin when File Explorer is disabled', async () => {
      mockApp.internalPlugins.getEnabledPluginById.mockReturnValue(null);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await asPrivate(plugin).onLayoutReady();

      expect(consoleErrorSpy).toHaveBeenCalledWith('File Explorer plugin is disabled. Disabling the plugin...');
      expect(mockApp.plugins.disablePlugin).toHaveBeenCalledWith('root-folder-context-menu');
    });

    it('should initialize file explorer and register patches when plugin is available', async () => {
      const mockFileExplorerView = {
        files: new Map(),
        openFileContextMenu: vi.fn()
      };
      const mockLeaf = {
        loadIfDeferred: vi.fn().mockResolvedValue(undefined),
        view: mockFileExplorerView
      };

      mockApp.internalPlugins.getEnabledPluginById.mockReturnValue({
        plugin: createMockFileExplorerPlugin()
      });

      setupRetryWithTimeoutToResolveLeaf(mockApp.workspace, mockLeaf);

      vi.stubGlobal('activeDocument', {
        body: { click: vi.fn() },
        querySelector: vi.fn().mockReturnValue(null)
      });

      await asPrivate(plugin).onLayoutReady();

      expect(registerPatch).toHaveBeenCalled();
    });

    it('should return early when file explorer view cannot be initialized', async () => {
      mockApp.internalPlugins.getEnabledPluginById.mockReturnValue({
        plugin: createMockFileExplorerPlugin()
      });

      const mockRetryWithTimeout = vi.mocked(retryWithTimeout);
      mockRetryWithTimeout.mockResolvedValue(undefined);

      await asPrivate(plugin).onLayoutReady();

      expect(registerPatch).not.toHaveBeenCalled();
    });

    it('should register vault switcher context menu when element exists', async () => {
      const mockFileExplorerView = {
        files: new Map(),
        openFileContextMenu: vi.fn()
      };
      const mockLeaf = {
        loadIfDeferred: vi.fn().mockResolvedValue(undefined),
        view: mockFileExplorerView
      };

      mockApp.internalPlugins.getEnabledPluginById.mockReturnValue({
        plugin: createMockFileExplorerPlugin()
      });

      setupRetryWithTimeoutToResolveLeaf(mockApp.workspace, mockLeaf);

      const mockVaultSwitcherEl = { childNodes: [{}] };
      const mockNavFilesContainerEl = {};

      vi.stubGlobal('activeDocument', {
        body: { click: vi.fn() },
        querySelector: vi.fn().mockImplementation((selector: string) => {
          if (selector === '.workspace-drawer-vault-switcher') {
            return mockVaultSwitcherEl;
          }
          if (selector === '.nav-files-container') {
            return mockNavFilesContainerEl;
          }
          return null;
        })
      });

      await asPrivate(plugin).onLayoutReady();

      expect(mockFileExplorerView.files.get(mockVaultSwitcherEl)).toBe(mockApp.vault.getRoot());
      expect(mockApp.workspace.on).toHaveBeenCalledWith('file-menu', expect.any(Function));
    });

    it('should handle vault switcher without nav files container', async () => {
      const mockFileExplorerView = {
        files: new Map(),
        openFileContextMenu: vi.fn()
      };
      const mockLeaf = {
        loadIfDeferred: vi.fn().mockResolvedValue(undefined),
        view: mockFileExplorerView
      };

      mockApp.internalPlugins.getEnabledPluginById.mockReturnValue({
        plugin: createMockFileExplorerPlugin()
      });

      setupRetryWithTimeoutToResolveLeaf(mockApp.workspace, mockLeaf);

      const mockVaultSwitcherEl = { childNodes: [{}] };

      vi.stubGlobal('activeDocument', {
        body: { click: vi.fn() },
        querySelector: vi.fn().mockImplementation((selector: string) => {
          if (selector === '.workspace-drawer-vault-switcher') {
            return mockVaultSwitcherEl;
          }
          return null;
        })
      });

      await asPrivate(plugin).onLayoutReady();

      expect(mockFileExplorerView.files.get(mockVaultSwitcherEl)).toBe(mockApp.vault.getRoot());
    });
  });

  describe('handleFileMenuEvent', () => {
    it('should not filter menu items for non-root files', () => {
      const menu = { items: [createMenuItem()] };
      const file = { path: 'some/path' };

      asPrivate(plugin).handleFileMenuEvent(menu, file);

      expect(menu.items).toHaveLength(1);
    });

    it('should filter root-specific menu items for root folder', () => {
      vi.stubGlobal('activeWindow', {
        i18next: {
          t: vi.fn().mockImplementation((key: string) => `translated-${key}`)
        }
      });

      const rootMenuItem = createMenuItem();
      // eslint-disable-next-line obsidianmd/ui/sentence-case -- Mock translation key, not UI text.
      rootMenuItem.titleEl.textContent = 'translated-plugins.file-explorer.menu-opt-rename';
      const nonRootMenuItem = createMenuItem();
      nonRootMenuItem.titleEl.textContent = 'Some other action';

      const menu = { items: [rootMenuItem, nonRootMenuItem] };
      const file = { path: '/' };

      asPrivate(plugin).handleFileMenuEvent(menu, file);

      expect(menu.items).toHaveLength(1);
      expect(menu.items[0]).toBe(nonRootMenuItem);

      vi.unstubAllGlobals();
    });

    it('should keep non-MenuItem items in the menu for root folder', () => {
      vi.stubGlobal('activeWindow', {
        i18next: {
          t: vi.fn().mockReturnValue('translated')
        }
      });

      const nonMenuItemEntry = { titleEl: { textContent: 'translated' } };
      const menu = { items: [nonMenuItemEntry] };
      const file = { path: '/' };

      asPrivate(plugin).handleFileMenuEvent(menu, file);

      expect(menu.items).toHaveLength(1);

      vi.unstubAllGlobals();
    });
  });

  describe('openFileContextMenu', () => {
    it('should return early when parent element is not HTMLElement', () => {
      vi.stubGlobal('HTMLElement', Object);

      const next = vi.fn();
      const view = { files: new Map() };
      const event = {};
      const fileItemElement = { parentElement: null };

      asPrivate(plugin).openFileContextMenu(next, view, event, fileItemElement);

      expect(next).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('should call next directly for non-root folders', () => {
      const next = vi.fn();
      const parentEl = {};
      const nonRootFolder = { isRoot: (): boolean => false, path: 'some-folder' };
      const view = { files: new Map([[parentEl, nonRootFolder]]) };
      const event = {};
      const fileItemElement = { parentElement: parentEl };

      vi.stubGlobal('HTMLElement', Object);

      asPrivate(plugin).openFileContextMenu(next, view, event, fileItemElement);

      expect(next).toHaveBeenCalledWith(event, fileItemElement);

      vi.unstubAllGlobals();
    });

    it('should temporarily patch isRoot for root folder and call next', () => {
      const next = vi.fn();
      const parentEl = {};
      const rootFolder = new TFolder();
      rootFolder.isRoot = (): boolean => true;
      Object.defineProperty(rootFolder, 'path', { value: '/' });

      const view = { files: new Map([[parentEl, rootFolder]]) };
      const event = {};
      const fileItemElement = { parentElement: parentEl };

      vi.stubGlobal('HTMLElement', Object);

      let isRootDuringCall: boolean | undefined;
      next.mockImplementation(() => {
        isRootDuringCall = rootFolder.isRoot();
      });

      asPrivate(plugin).openFileContextMenu(next, view, event, fileItemElement);

      expect(isRootDuringCall).toBe(false);
      expect(rootFolder.isRoot()).toBe(true);

      vi.unstubAllGlobals();
    });

    it('should call next directly for non-TFolder files', () => {
      const next = vi.fn();
      const parentEl = {};
      const regularFile = { path: 'test.md' };
      const view = { files: new Map([[parentEl, regularFile]]) };
      const event = {};
      const fileItemElement = { parentElement: parentEl };

      vi.stubGlobal('HTMLElement', Object);

      asPrivate(plugin).openFileContextMenu(next, view, event, fileItemElement);

      expect(next).toHaveBeenCalledWith(event, fileItemElement);

      vi.unstubAllGlobals();
    });
  });

  describe('initFileExplorerView', () => {
    it('should disable plugin when FileExplorerView initialization fails', async () => {
      const mockRetryWithTimeout = vi.mocked(retryWithTimeout);
      mockRetryWithTimeout.mockRejectedValue(new Error('Timeout'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await asPrivate(plugin).initFileExplorerView();

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockApp.plugins.disablePlugin).toHaveBeenCalledWith('root-folder-context-menu');
    });

    it('should set fileExplorerView when leaf is found', async () => {
      const mockView = { files: new Map() };
      const mockLeaf = {
        loadIfDeferred: vi.fn().mockResolvedValue(undefined),
        view: mockView
      };

      mockApp.workspace.getLeavesOfType.mockReturnValue([mockLeaf]);

      const mockRetryWithTimeout = vi.mocked(retryWithTimeout);
      mockRetryWithTimeout.mockImplementation(async (params: RetryParams) => {
        const result = await params.operationFn(new AbortController().signal);
        expect(result).toBe(true);
      });

      await asPrivate(plugin).initFileExplorerView();

      expect(mockLeaf.loadIfDeferred).toHaveBeenCalled();
    });

    it('should return false from operationFn when leaf is not found', async () => {
      mockApp.workspace.getLeavesOfType.mockReturnValue([]);

      const mockRetryWithTimeout = vi.mocked(retryWithTimeout);
      mockRetryWithTimeout.mockImplementation(async (params: RetryParams) => {
        const result = await params.operationFn(new AbortController().signal);
        expect(result).toBe(false);
      });

      await asPrivate(plugin).initFileExplorerView();
    });
  });

  describe('openContextMenu', () => {
    it('should call openFileContextMenu after delay', async () => {
      vi.useFakeTimers();
      vi.stubGlobal('activeDocument', { body: { click: vi.fn() } });
      vi.stubGlobal('sleep', vi.fn().mockResolvedValue(undefined));

      const mockOpenFileContextMenu = vi.fn();
      const childNode = {};

      Object.defineProperty(plugin, 'fileExplorerView', {
        value: { openFileContextMenu: mockOpenFileContextMenu },
        writable: true
      });

      const vaultSwitcherEl = { childNodes: [childNode] };
      const ev = {};

      await asPrivate(plugin).openContextMenu(ev, vaultSwitcherEl);

      expect(activeDocument.body.click).toHaveBeenCalled();
      expect(mockOpenFileContextMenu).toHaveBeenCalledWith(ev, childNode);

      vi.useRealTimers();
      vi.unstubAllGlobals();
    });
  });

  describe('reloadFileExplorer', () => {
    it('should disable and re-enable file explorer', async () => {
      const mockDisable = vi.fn();
      const mockEnable = vi.fn().mockResolvedValue(undefined);

      Object.defineProperty(plugin, 'fileExplorerPlugin', {
        value: { disable: mockDisable, enable: mockEnable },
        writable: true
      });

      const mockRetryWithTimeout = vi.mocked(retryWithTimeout);
      mockRetryWithTimeout.mockResolvedValue(undefined);

      await asPrivate(plugin).reloadFileExplorer();

      expect(mockDisable).toHaveBeenCalled();
      expect(mockEnable).toHaveBeenCalled();
    });
  });
});
