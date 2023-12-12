import { TFolder } from "obsidian";

export interface FileExplorerView {
    files: Map<HTMLElement | null, TFolder>
}

export type OpenFileContextMenuFunc = (this: FileExplorerView, event: Event, fileItemElement: HTMLElement) => void;

// TODO: Remove when PR https://github.com/Fevol/obsidian-typings/pull/16 is accepted
declare module "obsidian" {
    interface Plugin {
        disable: () => void;
        enable: () => void;
    }
}
