import { Plugin, TFile, TFolder } from "obsidian";
import { around } from "monkey-around";
import {
    FileExplorerView,
    OpenFileContextMenuFunc
} from "types";

export default class RootFolderContextMenu extends Plugin {
    fileExplorerPlugin!: Plugin;

    public onload(): void {
        this.app.workspace.onLayoutReady(() => {
            const FILE_EXPLORER_PLUGIN_ID = "file-explorer";
            this.fileExplorerPlugin = this.app.internalPlugins.getPluginById(FILE_EXPLORER_PLUGIN_ID);

            if (!this.fileExplorerPlugin) {
              throw new Error("File Explorer plugin is disabled")
            }

            const fileExplorerLeaf = this.app.workspace.getLeavesOfType(FILE_EXPLORER_PLUGIN_ID)[0];
    
            if (!fileExplorerLeaf) {
                throw new Error("File Explorer pane is not visible");
            }

            const view = fileExplorerLeaf.view;

            const removeFileExporerViewPatch = around(Object.getPrototypeOf(view), {
                openFileContextMenu: this.applyOpenFileContextMenuPatch
            });

            this.register(removeFileExporerViewPatch);
            this.register(this.reloadFileExplorer);
            this.reloadFileExplorer();
        });
    }

    private applyOpenFileContextMenuPatch(originalMethod: OpenFileContextMenuFunc): OpenFileContextMenuFunc {
        return function (this: FileExplorerView, event: Event, fileItemElement: HTMLElement): void {
            const file = this.files.get(fileItemElement.parentElement);

            if (!(file instanceof TFolder) || !file.isRoot()) {
                originalMethod.call(this, event, fileItemElement);
                return;
            }

            file.isRoot = () => false;
            originalMethod.call(this, event, fileItemElement);
            file.isRoot = () => true;
        };
    }

    private reloadFileExplorer() {
        console.log("Disabling File Explorer plugin");
        this.fileExplorerPlugin.disable();

        console.log("Enabling File Explorer plugin");
        this.fileExplorerPlugin.enable();
    }
}
