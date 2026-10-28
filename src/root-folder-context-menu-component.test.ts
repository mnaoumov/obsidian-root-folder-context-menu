import type { App as AppType } from 'obsidian';

import { FileExplorerRootMenuComponent } from '@mnaoumov/obsidian-lib/components/file-explorer-root-menu-component';
import { noop } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { waitForAllAsyncOperations } from '@mnaoumov/typescript-test-toolkit/async-operation-tracking';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { App } from 'obsidian-test-mocks/obsidian';
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

vi.mock('@mnaoumov/obsidian-lib/components/file-explorer-root-menu-component', async () => {
  const { Component } = await vi.importActual<typeof import('obsidian')>('obsidian');
  return {
    // eslint-disable-next-line prefer-arrow-callback -- The stub must be constructable.
    FileExplorerRootMenuComponent: vi.fn(function sharedMenuStub() {
      return new Component();
    })
  };
});

const PLUGIN_ID = 'root-folder-context-menu';
const PLUGIN_NAME = 'Root Folder Context Menu';
const STRICT_PROXY_TARGET_SYMBOL = Symbol.for('strictProxyTarget');

interface AppGlobal {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- Test setup replaces the global app and teardown restores it.
  app: AppType;
}

let app: AppType;
let appMock: App;
let savedGlobalApp: AppType;
let capturedLayoutReadyCallback: (() => void) | undefined;
let disablePluginMock: ReturnType<typeof vi.fn>;
let getEnabledPluginByIdMock: ReturnType<typeof vi.fn>;

describe('RootFolderContextMenuComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedLayoutReadyCallback = undefined;
    appMock = App.createConfigured__();
    app = appMock.asOriginalType__();

    disablePluginMock = vi.fn().mockResolvedValue(undefined);
    getEnabledPluginByIdMock = vi.fn();

    seedOnRawTarget(app, 'internalPlugins', { getEnabledPluginById: getEnabledPluginByIdMock });
    seedOnRawTarget(app, 'plugins', { disablePlugin: disablePluginMock });
    seedOnRawTarget(app.workspace, 'onLayoutReady', (callback: () => void) => {
      capturedLayoutReadyCallback = callback;
    });

    savedGlobalApp = castTo<AppGlobal>(window).app;
    castTo<AppGlobal>(window).app = app;
  });

  afterEach(() => {
    castTo<AppGlobal>(window).app = savedGlobalApp;
    activeDocument.body.replaceChildren();
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

    it('should request the shared folder presentation and release it on unload', async () => {
      getEnabledPluginByIdMock.mockReturnValue({});
      const component = createLoadedComponent();
      await fireLayoutReady();

      const shared = vi.mocked(FileExplorerRootMenuComponent);
      expect(shared).toHaveBeenCalledWith({ app, handler: noop, shouldPresentRootAsFolder: true });
      const child = castTo<FileExplorerRootMenuComponent>(shared.mock.results[0]?.value);
      const unloadSpy = vi.spyOn(child, 'unload');
      await unloadComponent(component);
      expect(unloadSpy).toHaveBeenCalledOnce();
    });
  });
});

function createLoadedComponent(): RootFolderContextMenuComponent {
  const component = new RootFolderContextMenuComponent({ app, plugin: createPluginMock() });
  component.load();
  return component;
}
function createPluginMock(): Plugin {
  return strictProxy<Plugin>({
    app,
    manifest: castTo<Plugin['manifest']>({ id: PLUGIN_ID, name: PLUGIN_NAME })
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
  // Async-operation tracking then drains the tracked onLayoutReady promise (and its child installation) deterministically.
  await waitForAllAsyncOperations();
}

async function unloadComponent(component: RootFolderContextMenuComponent): Promise<void> {
  component.unload();
  await settleAsyncOperations();
}
