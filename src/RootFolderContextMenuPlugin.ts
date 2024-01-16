import {
  Plugin,
  TFolder
} from "obsidian";
import { around } from "monkey-around";
import {
  FileExplorerView,
  OpenFileContextMenuFunc
} from "./types";
import type { FileExplorerPlugin } from "obsidian-typings";

export default class RootFolderContextMenu extends Plugin {
  private fileExplorerPlugin!: FileExplorerPlugin;

  public onload(): void {
    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));
  }

  private onLayoutReady(): void {
    const FILE_EXPLORER_PLUGIN_ID = "file-explorer";
    const fileExplorerPlugin = this.app.internalPlugins.getEnabledPluginById(FILE_EXPLORER_PLUGIN_ID);

    if (!fileExplorerPlugin) {
      throw new Error("File Explorer plugin is disabled");
    }

    this.fileExplorerPlugin = fileExplorerPlugin;

    const fileExplorerLeaf = this.app.workspace.getLeavesOfType(FILE_EXPLORER_PLUGIN_ID)[0];

    if (!fileExplorerLeaf) {
      throw new Error("File Explorer pane is not visible");
    }

    const view = fileExplorerLeaf.view;

    const removeFileExplorerViewPatch = around(Object.getPrototypeOf(view), {
      openFileContextMenu: this.applyOpenFileContextMenuPatch
    });

    this.register(removeFileExplorerViewPatch);
    this.register(this.reloadFileExplorer);
    this.reloadFileExplorer();
  }

  private applyOpenFileContextMenuPatch(originalMethod: OpenFileContextMenuFunc): OpenFileContextMenuFunc {
    return function (this: FileExplorerView, event: Event, fileItemElement: HTMLElement): void {
      const file = this.files.get(fileItemElement.parentElement);

      if (!(file instanceof TFolder) || !file.isRoot()) {
        originalMethod.call(this, event, fileItemElement);
        return;
      }

      file.isRoot = (): boolean => false;
      originalMethod.call(this, event, fileItemElement);
      file.isRoot = (): boolean => true;
    };
  }

  private reloadFileExplorer(): void {
    console.log("Disabling File Explorer plugin");
    this.fileExplorerPlugin.disable();

    console.log("Enabling File Explorer plugin");
    this.fileExplorerPlugin.enable();
  }
}
