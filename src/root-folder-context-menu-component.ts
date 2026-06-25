import type {
  FileExplorerPlugin,
  FileExplorerView
} from '@obsidian-typings/obsidian-public-latest';
import type { App } from 'obsidian';
import type { ConsoleDebugComponent } from 'obsidian-dev-utils/obsidian/components/console-debug-component';

import { InternalPluginName } from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  Menu,
  MenuItem,
  Notice,
  TAbstractFile
} from 'obsidian';
import {
  convertAsyncToSync,
  retryWithTimeout
} from 'obsidian-dev-utils/async';
import { LayoutReadyComponent } from 'obsidian-dev-utils/obsidian/components/layout-ready-component';

import { FileExplorerViewOpenFileContextMenuPatchComponent } from './patches/file-explorer-view-open-file-context-menu-patch-component.ts';

interface RootFolderContextMenuComponentConstructorParams {
  readonly app: App;
  readonly consoleDebugComponent: ConsoleDebugComponent;
  readonly pluginId: string;
}

export class RootFolderContextMenuComponent extends LayoutReadyComponent {
  private readonly consoleDebugComponent: ConsoleDebugComponent;
  private fileExplorerPlugin?: FileExplorerPlugin;
  private fileExplorerView?: FileExplorerView;
  private readonly pluginId: string;

  public constructor(params: RootFolderContextMenuComponentConstructorParams) {
    super(params.app);
    this.consoleDebugComponent = params.consoleDebugComponent;
    this.pluginId = params.pluginId;
  }

  protected override async onLayoutReady(): Promise<void> {
    const fileExplorerPluginInstance = this.app.internalPlugins.getEnabledPluginById(InternalPluginName.FileExplorer);

    if (!fileExplorerPluginInstance) {
      await this.disablePlugin('File Explorer plugin is disabled. Disabling the plugin...');
      return;
    }

    this.fileExplorerPlugin = fileExplorerPluginInstance.plugin;
    await this.initFileExplorerView();

    if (!this.fileExplorerView) {
      return;
    }

    this.addChild(new FileExplorerViewOpenFileContextMenuPatchComponent(this.fileExplorerView));

    this.register(this.reloadFileExplorer.bind(this));
    await this.reloadFileExplorer();

    const vaultSwitcherEl = activeDocument.querySelector<HTMLElement>('.workspace-drawer-vault-switcher');
    if (vaultSwitcherEl) {
      this.fileExplorerView.files.set(vaultSwitcherEl, this.app.vault.getRoot());
      this.registerDomEvent(
        vaultSwitcherEl,
        'contextmenu',
        /* v8 ignore start -- DOM event callback invoked by browser at runtime. */
        convertAsyncToSync(async (ev: MouseEvent): Promise<void> => this.openContextMenu(ev, vaultSwitcherEl))
        /* v8 ignore stop */
      );

      const navFilesContainerEl = activeDocument.querySelector<HTMLElement>('.nav-files-container');
      if (navFilesContainerEl) {
        this.registerDomEvent(
          navFilesContainerEl,
          'contextmenu',
          /* v8 ignore start -- DOM event callback invoked by browser at runtime. */
          convertAsyncToSync(async (ev: MouseEvent): Promise<void> => {
            if (ev.target !== navFilesContainerEl) {
              return;
            }
            await this.openContextMenu(ev, vaultSwitcherEl);
          })
          /* v8 ignore stop */
        );
      }
    }

    this.registerEvent(this.app.workspace.on('file-menu', this.handleFileMenuEvent.bind(this)));
  }

  private async disablePlugin(message: string): Promise<void> {
    console.error(message);
    new Notice(message);
    await this.app.plugins.disablePlugin(this.pluginId);
  }

  private handleFileMenuEvent(menu: Menu, file: TAbstractFile): void {
    if (file.path !== '/') {
      return;
    }

    const localizationKeys = [
      'plugins.file-explorer.action-move-folder',
      'plugins.file-explorer.menu-opt-delete',
      'plugins.file-explorer.menu-opt-make-copy',
      'plugins.file-explorer.menu-opt-rename',
      'plugins.search.menu-opt-search-in-folder'
    ];

    const localizedTitles = localizationKeys.map((key) => activeWindow.i18next.t(key));
    menu.items = menu.items.filter((item) => !(item instanceof MenuItem) || !localizedTitles.includes(item.titleEl.textContent));
  }

  private async initFileExplorerView(): Promise<void> {
    try {
      await retryWithTimeout({
        operationFn: async (): Promise<boolean> => {
          const fileExplorerLeaf = this.app.workspace.getLeavesOfType(InternalPluginName.FileExplorer)[0];

          if (fileExplorerLeaf) {
            this.consoleDebugComponent.consoleDebug('FileExplorerLeaf is initialized');
            await fileExplorerLeaf.loadIfDeferred();
            this.fileExplorerView = fileExplorerLeaf.view as FileExplorerView;
            return true;
          }

          this.consoleDebugComponent.consoleDebug('FileExplorerLeaf is not initialized yet. Repeating...');
          return false;
        },
        operationName: 'Initialize FileExplorerView'
      });
    } catch (e) {
      console.error(e);
      await this.disablePlugin('Could not initialize FileExplorerView. Disabling the plugin...');
    }
  }

  private async openContextMenu(ev: Event, vaultSwitcherEl: HTMLElement): Promise<void> {
    const RETRY_DELAY_IN_MILLISECONDS = 100;
    await sleep(RETRY_DELAY_IN_MILLISECONDS);
    activeDocument.body.click();
    this.fileExplorerView?.openFileContextMenu(ev, vaultSwitcherEl.childNodes[0] as HTMLElement);
  }

  private async reloadFileExplorer(): Promise<void> {
    this.consoleDebugComponent.consoleDebug('Disabling File Explorer plugin');
    this.fileExplorerPlugin?.disable();

    this.consoleDebugComponent.consoleDebug('Enabling File Explorer plugin');
    await this.fileExplorerPlugin?.enable();
    await this.initFileExplorerView();
  }
}
