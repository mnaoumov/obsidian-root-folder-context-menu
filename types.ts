import { TAbstractFile } from "obsidian";

export interface FileExplorerView {
    files: Map<HTMLElement | null, TAbstractFile>
}

export type OpenFileContextMenuFunc = (this: FileExplorerView, event: Event, fileItemElement: HTMLElement) => void;

// TODO: Remove when PR https://github.com/Fevol/obsidian-typings/pull/16 is accepted
declare module "obsidian" {
    interface Plugin {
        disable: () => void;
        enable: () => void;
    }
}
