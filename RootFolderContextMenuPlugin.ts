import { Plugin, TFile, TFolder } from "obsidian";
import { around } from "monkey-around";
import {
    FileExplorerView,
    OpenFileContextMenuFunc
} from "types";

export default class RootFolderContextMenu extends Plugin {
    removeFileExporerViewPatch!: () => void;
    fileExplorerPlugin!: Plugin;

    public onload(): void {
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

        this.removeFileExporerViewPatch = around(Object.getPrototypeOf(view), {
            openFileContextMenu: this.applyOpenFileContextMenuPatch
        });

        this.reloadFileExplorer();
    }

    private applyOpenFileContextMenuPatch(originalMethod: OpenFileContextMenuFunc): OpenFileContextMenuFunc {
        return function (this: FileExplorerView, event: Event, fileItemElement: HTMLElement): void {
            const file = this.files.get(fileItemElement.parentElement);

            if (!(file instanceof TFolder)) {
                originalMethod.call(this, event, fileItemElement);
                return;
            }

            const isRoot = file.isRoot();

            if (isRoot) {
                file.isRoot = () => false;
            }

            originalMethod.call(this, event, fileItemElement);

            if (isRoot) {
                file.isRoot = () => true;
            }
        };
    }

    public onunload(): void {
        this.removeFileExporerViewPatch();
        this.reloadFileExplorer();
    }

    private reloadFileExplorer() {
        console.log("Disabling File Explorer plugin");
        this.fileExplorerPlugin.disable();

        console.log("Enabling File Explorer plugin");
        this.fileExplorerPlugin.enable();
    }
}
