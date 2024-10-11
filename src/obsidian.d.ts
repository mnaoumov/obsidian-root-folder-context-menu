declare module "obsidian" {
  export class Plugin {
    public app: App;
    public manifest: PluginManifest;
    public constructor(app: App, manifest: PluginManifest);
    public onload(): void;
    public register(cb: () => unknown): void;
    public registerDomEvent(el: HTMLElement, type: string, callback: (evt: Event) => unknown): void;
  }

  export class App {
    public workspace: Workspace;
    public vault: Vault;
    public commands: {
      executeCommandById(id: string): boolean;
    };
    public plugins: {
      disablePlugin(id: string): Promise<void>;
    };
    public internalPlugins: {
      getPluginById(id: string): unknown;
    };
  }

  export class Workspace {
    public onLayoutReady(callback: () => void): void;
    public getLeavesOfType(type: string): WorkspaceLeaf[];
    public getLeaf(create?: boolean): WorkspaceLeaf;
  }

  export class Vault {
    public getRoot(): TFolder;
    public create(path: string, data: string): Promise<TFile>;
    public createFolder(path: string): Promise<void>;
    public adapter: {
      exists(path: string): Promise<boolean>;
    };
  }

  export class TFolder {
    public isRoot(): boolean;
  }

  export class TFile {
    public path: string;
  }

  export class WorkspaceLeaf {
    public view: View;
    public openFile(file: TFile): Promise<void>;
  }

  export class View {}

  export class FileExplorerView extends View {
    public files: Map<HTMLElement, TFolder>;
    public openFileContextMenu(event: Event, fileItemElement: HTMLElement): void;
  }

  export class Notice {
    public constructor(message: string);
  }

  export interface PluginManifest {
    id: string;
  }

  export class Menu {
    public constructor(app: App);
    public addItem(cb: (item: MenuItem) => unknown): this;
    public showAtMouseEvent(event: MouseEvent): void;
  }

  export interface MenuItem {
    setTitle(title: string): this;
    setIcon(icon: string): this;
    onClick(callback: () => unknown): this;
  }
}
