import type {
  FileExplorerPlugin,
  FileExplorerView
} from '@obsidian-typings/obsidian-public-latest';
import type {
  App,
  PluginManifest
} from 'obsidian';

import { InternalPluginName } from '@obsidian-typings/obsidian-public-latest/implementations';
import {
  Menu,
  MenuItem,
  Notice,
  TAbstractFile,
  TFolder
} from 'obsidian';
import {
  convertAsyncToSync,
  retryWithTimeout
} from 'obsidian-dev-utils/async';
import { getPrototypeOf } from 'obsidian-dev-utils/object-utils';
import { CallbackLayoutReadyComponent } from 'obsidian-dev-utils/obsidian/components/layout-ready-component';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';

type OpenFileContextMenuFn = FileExplorerView['openFileContextMenu'];

export class Plugin extends PluginBase {
  private fileExplorerPlugin?: FileExplorerPlugin;
  private fileExplorerView?: FileExplorerView;
  private readonly monkeyAroundComponent: MonkeyAroundComponent;

  public constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.monkeyAroundComponent = this.addChild(new MonkeyAroundComponent());
    this.addChild(new CallbackLayoutReadyComponent(this.app, this.onLayoutReady.bind(this)));
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

  private async onLayoutReady(): Promise<void> {
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

    const viewPrototype = getPrototypeOf(this.fileExplorerView);

    const that = this;
    this.monkeyAroundComponent.registerPatch(viewPrototype, {
      openFileContextMenu: (next: OpenFileContextMenuFn) => {
        /* v8 ignore start -- runtime-only callback invoked by Obsidian's monkey-patch system. */
        return function openFileContextMenuPatched(this: FileExplorerView, event: Event, fileItemElement: HTMLElement): void {
          that.openFileContextMenu(next, this, event, fileItemElement);
        };
        /* v8 ignore stop */
      }
    });

    this.register(this.reloadFileExplorer.bind(this));
    await this.reloadFileExplorer();

    const vaultSwitcherEl = activeDocument.querySelector<HTMLElement>('.workspace-drawer-vault-switcher');
    if (vaultSwitcherEl) {
      this.fileExplorerView.files.set(vaultSwitcherEl, this.app.vault.getRoot());
      this.registerDomEvent(
        vaultSwitcherEl,
        'contextmenu',
        /* v8 ignore start -- DOM event callback invoked by browser at runtime. */
        convertAsyncToSync(async (ev: MouseEvent): Promise<void> => {
          await this.openContextMenu(ev, vaultSwitcherEl);
        })
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

  private async openContextMenu(ev: Event, vaultSwitcherEl: HTMLElement): Promise<void> {
    const RETRY_DELAY_IN_MILLISECONDS = 100;
    await sleep(RETRY_DELAY_IN_MILLISECONDS);
    activeDocument.body.click();
    this.fileExplorerView?.openFileContextMenu(ev, vaultSwitcherEl.childNodes[0] as HTMLElement);
  }

  private openFileContextMenu(next: OpenFileContextMenuFn, view: FileExplorerView, event: Event, fileItemElement: HTMLElement): void {
    if (!(fileItemElement.parentElement instanceof HTMLElement)) {
      return;
    }
    const file = view.files.get(fileItemElement.parentElement);

    if (!(file instanceof TFolder) || !file.isRoot()) {
      next.call(view, event, fileItemElement);
      return;
    }

    file.isRoot = (): boolean => false;
    next.call(view, event, fileItemElement);
    file.isRoot = (): boolean => true;
  }

  private async reloadFileExplorer(): Promise<void> {
    this.consoleDebugComponent.consoleDebug('Disabling File Explorer plugin');
    this.fileExplorerPlugin?.disable();

    this.consoleDebugComponent.consoleDebug('Enabling File Explorer plugin');
    await this.fileExplorerPlugin?.enable();
    await this.initFileExplorerView();
  }
}
