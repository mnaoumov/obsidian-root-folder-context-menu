import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin', () => ({
  PluginBase: vi.fn()
}));

vi.mock('obsidian', () => ({
  Component: vi.fn(),
  Menu: vi.fn(),
  MenuItem: vi.fn(),
  Notice: vi.fn(),
  TAbstractFile: vi.fn(),
  TFolder: vi.fn()
}));

vi.mock('obsidian-dev-utils/async', () => ({
  convertAsyncToSync: vi.fn(),
  retryWithTimeout: vi.fn()
}));

vi.mock('obsidian-dev-utils/object-utils', () => ({
  getPrototypeOf: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/monkey-around', () => ({
  registerPatch: vi.fn()
}));

vi.mock('@obsidian-typings/obsidian-public-latest/implementations', () => ({
  InternalPluginName: { FileExplorer: 'file-explorer' }
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import Plugin from './main.ts';
// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin as PluginClass } from './plugin.ts';

describe('main', () => {
  it('should export Plugin as default export', () => {
    expect(Plugin).toBe(PluginClass);
  });
});
