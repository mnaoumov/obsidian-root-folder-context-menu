import { TAbstractFile } from "obsidian";

export interface FileExplorerView {
  files: Map<HTMLElement | null, TAbstractFile>
}

export type OpenFileContextMenuFunc = (this: FileExplorerView, event: Event, fileItemElement: HTMLElement) => void;
