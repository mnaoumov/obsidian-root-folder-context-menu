import type {
  FileExplorerPlugin,
  FileExplorerView
} from 'obsidian-typings';

import { around } from 'monkey-around';
import {
  Menu,
  Notice,
  PluginSettingTab,
  TAbstractFile,
  TFolder
} from 'obsidian';
import { retryWithTimeout } from 'obsidian-dev-utils/Async';
import { getPrototypeOf } from 'obsidian-dev-utils/Object';
import { EmptySettings } from 'obsidian-dev-utils/obsidian/Plugin/EmptySettings';
import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';
import { InternalPluginName } from 'obsidian-typings/implementations';

export class RootFolderContextMenu extends PluginBase {
  private fileExplorerPlugin!: FileExplorerPlugin;
  private fileExplorerView!: FileExplorerView;

  protected override createPluginSettings(): EmptySettings {
    return new EmptySettings();
  }

  protected override createPluginSettingsTab(): null | PluginSettingTab {
    return null;
  }

  protected override async onLayoutReady(): Promise<void> {
    const fileExplorerPluginInstance = this.app.internalPlugins.getEnabledPluginById(InternalPluginName.FileExplorer);

    if (!fileExplorerPluginInstance) {
      await this.disablePlugin('File Explorer plugin is disabled. Disabling the plugin...');
      return;
    }

    this.fileExplorerPlugin = fileExplorerPluginInstance.plugin;
    await this.initFileExplorerView();

    const viewPrototype = getPrototypeOf(this.fileExplorerView);

    const removeFileExplorerViewPatch = around(viewPrototype, {
      openFileContextMenu: this.applyOpenFileContextMenuPatch.bind(this)
    });

    this.register(removeFileExplorerViewPatch);
    this.register(this.reloadFileExplorer.bind(this));
    await this.reloadFileExplorer();

    const vaultSwitcherEl = document.querySelector<HTMLElement>('.workspace-drawer-vault-switcher');
    if (vaultSwitcherEl) {
      this.fileExplorerView.files.set(vaultSwitcherEl, this.app.vault.getRoot());
      this.registerDomEvent(vaultSwitcherEl, 'contextmenu', async (ev: MouseEvent): Promise<void> => {
        await this.openContextMenu(ev, vaultSwitcherEl);
      });

      const navFilesContainerEl = document.querySelector<HTMLElement>('.nav-files-container');
      if (navFilesContainerEl) {
        this.registerDomEvent(navFilesContainerEl, 'contextmenu', async (ev: MouseEvent): Promise<void> => {
          if (ev.target !== navFilesContainerEl) {
            return;
          }
          await this.openContextMenu(ev, vaultSwitcherEl);
        });
      }
    }

    this.registerEvent(this.app.workspace.on('file-menu', this.handleFileMenuEvent.bind(this)));
  }

  private applyOpenFileContextMenuPatch(next: FileExplorerView['openFileContextMenu']): FileExplorerView['openFileContextMenu'] {
    return function (this: FileExplorerView, event: Event, fileItemElement: HTMLElement): void {
      if (!fileItemElement.parentElement) {
        return;
      }
      const file = this.files.get(fileItemElement.parentElement);

      if (!(file instanceof TFolder) || !file.isRoot()) {
        next.call(this, event, fileItemElement);
        return;
      }

      file.isRoot = (): boolean => false;
      next.call(this, event, fileItemElement);
      file.isRoot = (): boolean => true;
    };
  }

  private async disablePlugin(message: string): Promise<void> {
    console.error(message);
    new Notice(message);
    await this.app.plugins.disablePlugin(this.manifest.id);
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

    const localizedTitles = localizationKeys.map((key) => i18next.t(key));
    menu.items = menu.items.filter((item) => !localizedTitles.includes(item.titleEl.textContent ?? ''));
  }

  private async initFileExplorerView(): Promise<void> {
    try {
      await retryWithTimeout(async (): Promise<boolean> => {
        const fileExplorerLeaf = this.app.workspace.getLeavesOfType(InternalPluginName.FileExplorer)[0];

        if (fileExplorerLeaf) {
          this.consoleDebug('FileExplorerLeaf is initialized');
          await fileExplorerLeaf.loadIfDeferred();
          this.fileExplorerView = fileExplorerLeaf.view as FileExplorerView;
          return true;
        }

        this.consoleDebug('FileExplorerLeaf is not initialized yet. Repeating...');
        return false;
      });
    } catch (e) {
      console.error(e);
      await this.disablePlugin('Could not initialize FileExplorerView. Disabling the plugin...');
    }
  }

  private async openContextMenu(ev: Event, vaultSwitcherEl: HTMLElement): Promise<void> {
    const RETRY_DELAY_IN_MILLISECONDS = 100;
    await sleep(RETRY_DELAY_IN_MILLISECONDS);
    document.body.click();
    this.fileExplorerView.openFileContextMenu(ev, vaultSwitcherEl.childNodes[0] as HTMLElement);
  }

  private async reloadFileExplorer(): Promise<void> {
    console.log('Disabling File Explorer plugin');
    this.fileExplorerPlugin.disable();

    console.log('Enabling File Explorer plugin');
    await this.fileExplorerPlugin.enable();
    await this.initFileExplorerView();
  }
}
