import {
  TAbstractFile,
  View,
  WorkspaceLeaf
} from "obsidian";

// TODO: Remove when PR https://github.com/Fevol/obsidian-typings/pull/26 is accepted
export interface FileExplorerLeaf extends WorkspaceLeaf {
  view: FileExplorerView;
}

export interface FileExplorerView extends View {
  files: WeakMapWrapper<HTMLElement, TAbstractFile>;

  openFileContextMenu(event: Event, fileItemElement: HTMLElement): void;
}

interface WeakMapWrapper<K extends WeakKey, V> extends WeakMap<K, V> {
  map: WeakMap<K, V>;
}
