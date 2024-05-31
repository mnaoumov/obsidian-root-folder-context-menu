import {
  Plugin,
  TFolder
} from "obsidian";
import { around } from "monkey-around";
import type {
  FileExplorerLeaf,
  InternalPlugin,
  FileExplorerView
} from "obsidian-typings";
import {
  delay,
  RETRY_DELAY_IN_MILLISECONDS,
  retryWithTimeout,
} from "./Async.ts";

const FILE_EXPLORER_PLUGIN_ID = "file-explorer";

export default class RootFolderContextMenu extends Plugin {
  private fileExplorerPlugin!: InternalPlugin;
  private fileExplorerView!: FileExplorerView;

  public override onload(): void {
    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));
  }

  private async onLayoutReady(): Promise<void> {
    const fileExplorerPluginInstance = this.app.internalPlugins.getEnabledPluginById(FILE_EXPLORER_PLUGIN_ID);

    if (!fileExplorerPluginInstance) {
      throw new Error("File Explorer plugin is disabled");
    }

    this.fileExplorerPlugin = fileExplorerPluginInstance.plugin;
    await this.initFileExplorerView();

    const viewPrototype = Object.getPrototypeOf(this.fileExplorerView) as FileExplorerView;

    const removeFileExplorerViewPatch = around(viewPrototype, {
      openFileContextMenu: this.applyOpenFileContextMenuPatch.bind(this),
    });

    this.register(removeFileExplorerViewPatch);
    this.register(this.reloadFileExplorer.bind(this));
    await this.reloadFileExplorer();

    const vaultSwitcherEl = document.querySelector(".workspace-drawer-vault-switcher") as HTMLElement | undefined;
    if (vaultSwitcherEl) {
      this.fileExplorerView.files.set(vaultSwitcherEl, this.app.vault.getRoot());
      this.registerDomEvent(vaultSwitcherEl, "contextmenu", async (ev: MouseEvent): Promise<void> => {
        await delay(RETRY_DELAY_IN_MILLISECONDS);
        document.body.click();
        this.fileExplorerView.openFileContextMenu(ev, vaultSwitcherEl.childNodes[0] as HTMLElement);
      });
    }
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

  private async reloadFileExplorer(): Promise<void> {
    console.log("Disabling File Explorer plugin");
    this.fileExplorerPlugin.disable();

    console.log("Enabling File Explorer plugin");
    await this.fileExplorerPlugin.enable();
    await this.initFileExplorerView();
  }

  private async initFileExplorerView(): Promise<void> {
    try {
      await retryWithTimeout(async () => {
        const fileExplorerLeaf = this.app.workspace.getLeavesOfType(FILE_EXPLORER_PLUGIN_ID)[0] as FileExplorerLeaf;

        if (fileExplorerLeaf) {
          console.debug("FileExplorerLeaf is initialized");
          this.fileExplorerView = fileExplorerLeaf.view;
          return true;
        }

        console.debug("FileExplorerLeaf is not initialized yet. Repeating...");
        return false;
      });
    } catch (e) {
      console.error("Could not initialize FileExplorerView. Disabling the plugin...", e);
      await this.app.plugins.disablePlugin(this.manifest.id);
    }
  }
}
