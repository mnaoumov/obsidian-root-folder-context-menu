import type { FileExplorerView } from '@obsidian-typings/obsidian-public-latest';
import type { TFolder as TFolderType } from 'obsidian';
import type { MockInstance } from 'vitest';

import { noop } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import {
  App,
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

import { FileExplorerViewOpenFileContextMenuPatchComponent } from './file-explorer-view-open-file-context-menu-patch-component.ts';

interface FileItemElements {
  fileItemElement: HTMLElement;
  parentElement: HTMLElement;
}

interface LoadPatchResult {
  readonly originalSpy: OpenFileContextMenuSpy;
  readonly view: FakeFileExplorerView;
}

type OpenFileContextMenuSpy = MockInstance<(event: Event, fileItemElement: HTMLElement) => void>;

let appMock: App;
let component: FileExplorerViewOpenFileContextMenuPatchComponent | undefined;

describe('FileExplorerViewOpenFileContextMenuPatchComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appMock = App.createConfigured__();
    component = undefined;
  });

  afterEach(() => {
    // Unload removes the prototype patch so it cannot leak across tests.
    component?.unload();
  });

  it('should return early without calling the original method when the parent element is not an HTMLElement', () => {
    const { originalSpy, view } = loadPatch();
    const fileItemElement = activeDocument.createElement('div');

    castTo<FileExplorerView>(view).openFileContextMenu(new Event('contextmenu'), fileItemElement);

    expect(originalSpy).not.toHaveBeenCalled();
  });

  it('should call the original method directly for non-folder files', () => {
    const { originalSpy, view } = loadPatch();
    const { fileItemElement, parentElement } = createFileItemElements();
    view.files.set(parentElement, { path: 'test.md' });
    const event = new Event('contextmenu');

    castTo<FileExplorerView>(view).openFileContextMenu(event, fileItemElement);

    expect(originalSpy).toHaveBeenCalledWith(event, fileItemElement);
  });

  it('should call the original method directly for non-root folders', () => {
    const { originalSpy, view } = loadPatch();
    const { fileItemElement, parentElement } = createFileItemElements();
    view.files.set(parentElement, TFolder.create__(appMock.vault, 'some-folder'));
    const event = new Event('contextmenu');

    castTo<FileExplorerView>(view).openFileContextMenu(event, fileItemElement);

    expect(originalSpy).toHaveBeenCalledWith(event, fileItemElement);
  });

  it('should temporarily report the root folder as non-root while calling the original method', () => {
    const { originalSpy, view } = loadPatch();
    const { fileItemElement, parentElement } = createFileItemElements();
    const rootFolder = castTo<TFolderType>(appMock.vault.getRoot());
    view.files.set(parentElement, rootFolder);

    let isRootDuringFallback: boolean | undefined;
    originalSpy.mockImplementation(() => {
      isRootDuringFallback = rootFolder.isRoot();
    });

    castTo<FileExplorerView>(view).openFileContextMenu(new Event('contextmenu'), fileItemElement);

    expect(isRootDuringFallback).toBe(false);
    expect(rootFolder.isRoot()).toBe(true);
  });
});

class FakeFileExplorerView {
  public files = new Map();

  public openFileContextMenu(_event: Event, _fileItemElement: HTMLElement): void {
    noop();
  }
}

function createFileItemElements(): FileItemElements {
  const parentElement = activeDocument.createElement('div');
  const fileItemElement = activeDocument.createElement('div');
  parentElement.appendChild(fileItemElement);
  return { fileItemElement, parentElement };
}

function loadPatch(): LoadPatchResult {
  const view = new FakeFileExplorerView();
  // Spy on the prototype method so the real MonkeyAroundComponent patch wraps it and `fallback()` invokes the spy.
  const originalSpy: OpenFileContextMenuSpy = vi.spyOn(FakeFileExplorerView.prototype, 'openFileContextMenu');
  component = new FileExplorerViewOpenFileContextMenuPatchComponent(castTo<FileExplorerView>(view));
  component.load();
  return { originalSpy, view };
}
