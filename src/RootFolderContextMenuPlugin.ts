import {
  App,
  Plugin,
  PluginManifest,
  Menu,
  MenuItem,
  TFile
} from "obsidian";

export default class RootFolderContextMenu extends Plugin {
  public constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }

  public override onload(): void {
    super.onload();
    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));
  }

  private onLayoutReady(): void {
    this.addContextMenu();
  }

  private addContextMenu(): void {
    const navFilesContainer = document.querySelector(".nav-files-container");
    if (navFilesContainer instanceof HTMLElement) {
      this.registerDomEvent(navFilesContainer, "contextmenu", (event: Event) => {
        // Prevent the default context menu
        event.preventDefault();

        // Create a new menu
        const menu = new Menu(this.app);

        // Add menu items
        menu.addItem((item: MenuItem) => {
          item
            .setTitle("New note in root")
            .setIcon("create-new")
            .onClick(async () => {
              await this.createNewFileInRoot();
            });
        });

        menu.addItem((item: MenuItem) => {
          item
            .setTitle("New folder in root")
            .setIcon("folder")
            .onClick(async () => {
              await this.createNewFolderInRoot();
            });
        });

        // Show the menu
        menu.showAtMouseEvent(event as MouseEvent);
      });
    } else {
      console.error("Nav files container not found");
    }
  }

  private async createNewFileInRoot(): Promise<void> {
    const fileName = "Untitled";
    let fileNumber = 1;
    let filePath = `/${fileName}.md`;

    while (await this.app.vault.adapter.exists(filePath)) {
      filePath = `/${fileName} ${fileNumber}.md`;
      fileNumber++;
    }

    try {
      const file = await this.app.vault.create(filePath, "");
      if (file instanceof TFile) {
        const leaf = this.app.workspace.getLeaf();
        if (leaf) {
          await leaf.openFile(file);
        }
      }
    } catch (error) {
      console.error("Error creating new file:", error);
    }
  }

  private async createNewFolderInRoot(): Promise<void> {
    const folderName = "New Folder";
    let folderNumber = 1;
    let folderPath = `/${folderName}`;

    while (await this.app.vault.adapter.exists(folderPath)) {
      folderPath = `/${folderName} ${folderNumber}`;
      folderNumber++;
    }

    try {
      await this.app.vault.createFolder(folderPath);
    } catch (error) {
      console.error("Error creating new folder:", error);
    }
  }
}
