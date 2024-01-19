import {
  Plugin,
  TFolder
} from "obsidian";
import { around } from "monkey-around";
import {
  FileExplorerLeaf,
  FileExplorerView,
} from "./types.ts";
import type { FileExplorerPlugin } from "obsidian-typings";

export default class RootFolderContextMenu extends Plugin {
  private fileExplorerPlugin!: FileExplorerPlugin;

  public override onload(): void {
    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));
  }

  private onLayoutReady(): void {
    const FILE_EXPLORER_PLUGIN_ID = "file-explorer";
    const fileExplorerPlugin = this.app.internalPlugins.getEnabledPluginById(FILE_EXPLORER_PLUGIN_ID);

    if (!fileExplorerPlugin) {
      throw new Error("File Explorer plugin is disabled");
    }

    this.fileExplorerPlugin = fileExplorerPlugin;

    const fileExplorerLeaf = this.app.workspace.getLeavesOfType(FILE_EXPLORER_PLUGIN_ID)[0] as FileExplorerLeaf;

    if (!fileExplorerLeaf) {
      throw new Error("File Explorer pane is not visible");
    }

    const view = fileExplorerLeaf.view;
    const viewPrototype = Object.getPrototypeOf(view) as FileExplorerView;

    const removeFileExplorerViewPatch = around(viewPrototype, {
      openFileContextMenu: this.applyOpenFileContextMenuPatch.bind(this),
    });

    this.register(removeFileExplorerViewPatch);
    this.register(this.reloadFileExplorer.bind(this));
    this.reloadFileExplorer();
  }

  private applyOpenFileContextMenuPatch(next: FileExplorerView["openFileContextMenu"]): FileExplorerView["openFileContextMenu"] {
    return function (this: FileExplorerView, event: Event, fileItemElement: HTMLElement): void {
      const file = this.files.get(fileItemElement.parentElement!);

      if (!(file instanceof TFolder) || !file.isRoot()) {
        next.call(this, event, fileItemElement);
        return;
      }

      file.isRoot = (): boolean => false;
      next.call(this, event, fileItemElement);
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
