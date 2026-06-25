import type {
  App as AppType,
  PluginManifest
} from 'obsidian';

import { castTo } from 'obsidian-dev-utils/object-utils';
import { ConsoleDebugComponent } from 'obsidian-dev-utils/obsidian/components/console-debug-component';
import { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { Plugin } from './plugin.ts';
import { RootFolderContextMenuComponent } from './root-folder-context-menu-component.ts';

vi.mock('./root-folder-context-menu-component.ts', async () => {
  const { Component } = await vi.importActual<ObsidianModule>('obsidian');
  return {
    // eslint-disable-next-line prefer-arrow-callback -- A `function` form is required so vitest can `new` the stub (an arrow throws), and the body must return a fresh real Component.
    RootFolderContextMenuComponent: vi.fn(function rootFolderContextMenuComponentStub() {
      return new Component();
    })
  };
});

const PLUGIN_ID = 'root-folder-context-menu';
const STRICT_PROXY_TARGET_SYMBOL = Symbol.for('strictProxyTarget');

interface AppGlobal {
  app: AppType;
}

interface LoadedFlagHolder {
  loaded__: boolean;
}

interface ObsidianModule {
  Component: new () => object;
}

interface RootFolderContextMenuComponentConstructorParams {
  readonly app: AppType;
  readonly consoleDebugComponent: ConsoleDebugComponent;
  readonly pluginId: string;
  readonly pluginNoticeComponent: PluginNoticeComponent;
}

const manifest = castTo<PluginManifest>({ id: PLUGIN_ID });

let app: AppType;
let appMock: App;
let savedGlobalApp: AppType;

describe('Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appMock = App.createConfigured__();
    app = appMock.asOriginalType__();

    // The real PluginBase reads dev-utils state off the app (and the global app).
    seedOnRawTarget(app, 'obsidianDevUtilsState', {});
    seedOnRawTarget(app.workspace, 'onLayoutReady', () => {
      // The wrapper test never fires layout-ready; the child component is a stub.
    });

    savedGlobalApp = castTo<AppGlobal>(window).app;
    castTo<AppGlobal>(window).app = app;
  });

  afterEach(() => {
    castTo<AppGlobal>(window).app = savedGlobalApp;
  });

  it('should add the root folder context menu component with the app, console debug component, plugin id, and notice component', async () => {
    const plugin = new Plugin(app, manifest);
    // PluginBase.onload is async; driving it directly runs onloadImpl and eager-loads the child.
    await plugin.onload();

    const calls = vi.mocked(RootFolderContextMenuComponent).mock.calls;
    expect(calls).toHaveLength(1);

    const params = castTo<RootFolderContextMenuComponentConstructorParams>(calls[0]?.[0]);
    expect(params.app).toBe(plugin.app);
    expect(params.consoleDebugComponent).toBeInstanceOf(ConsoleDebugComponent);
    expect(params.pluginId).toBe(PLUGIN_ID);
    expect(params.pluginNoticeComponent).toBeInstanceOf(PluginNoticeComponent);

    castTo<LoadedFlagHolder>(plugin).loaded__ = true;
    plugin.unload();
  });
});

function seedOnRawTarget(strictProxiedObject: object, key: string, value: unknown): void {
  const rawTarget = castTo<object | undefined>(Reflect.get(strictProxiedObject, STRICT_PROXY_TARGET_SYMBOL)) ?? strictProxiedObject;
  Reflect.set(rawTarget, key, value);
}
