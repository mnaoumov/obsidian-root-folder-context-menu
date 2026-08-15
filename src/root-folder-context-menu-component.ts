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
  TAbstractFile
} from 'obsidian';
import {
  convertAsyncToSync,
  retryWithTimeout
} from 'obsidian-dev-utils/async';
import { LayoutReadyComponent } from 'obsidian-dev-utils/obsidian/components/layout-ready-component';
import { showErrorAndDisablePlugin } from 'obsidian-dev-utils/obsidian/plugin/plugin';

import type { Plugin } from './plugin.ts';

import { FileExplorerViewOpenFileContextMenuPatchComponent } from './patches/file-explorer-view-open-file-context-menu-patch-component.ts';

// The element the root context menu is anchored to, in priority order.
// Obsidian builds `.workspace-drawer-vault-switcher` only inside `if (isDesktopApp)`.
// On mobile the vault name lives in the left drawer header instead, so the desktop selector never matches.
const ROOT_ANCHOR_SELECTORS = [
  '.workspace-drawer-vault-switcher',
  '.workspace-drawer-header-name'
];

interface RootFolderContextMenuComponentConstructorParams {
  readonly app: App;
  readonly consoleDebugComponent: ConsoleDebugComponent;
  readonly plugin: Plugin;
}

export class RootFolderContextMenuComponent extends LayoutReadyComponent {
  private readonly consoleDebugComponent: ConsoleDebugComponent;
  private fileExplorerPlugin?: FileExplorerPlugin;
  private fileExplorerView?: FileExplorerView;
  private readonly plugin: Plugin;

  public constructor(params: RootFolderContextMenuComponentConstructorParams) {
    super(params.app);
    this.consoleDebugComponent = params.consoleDebugComponent;
    this.plugin = params.plugin;
  }

  protected override async onLayoutReady(): Promise<void> {
    const fileExplorerPluginInstance = this.app.internalPlugins.getEnabledPluginById(InternalPluginName.FileExplorer);

    if (!fileExplorerPluginInstance) {
      await showErrorAndDisablePlugin(this.plugin, 'File Explorer plugin is disabled. Disabling the plugin...');
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

    const rootAnchorEl = findRootAnchorEl();
    if (rootAnchorEl) {
      this.fileExplorerView.files.set(rootAnchorEl, this.app.vault.getRoot());
      this.registerDomEvent(
        rootAnchorEl,
        'contextmenu',
        /* v8 ignore start -- DOM event callback invoked by browser at runtime. */
        convertAsyncToSync(async ($event: MouseEvent): Promise<void> => this.openContextMenu($event, rootAnchorEl))
        /* v8 ignore stop */
      );

      // The empty area below the file list opens the same menu, anchored to the same element.
      const navFilesContainerEl = activeDocument.querySelector<HTMLElement>('.nav-files-container');
      if (navFilesContainerEl) {
        this.registerDomEvent(
          navFilesContainerEl,
          'contextmenu',
          /* v8 ignore start -- DOM event callback invoked by browser at runtime. */
          convertAsyncToSync(async ($event: MouseEvent): Promise<void> => {
            if ($event.target !== navFilesContainerEl) {
              return;
            }
            await this.openContextMenu($event, rootAnchorEl);
          })
          /* v8 ignore stop */
        );
      }
    } else {
      this.consoleDebugComponent.consoleDebug(`No root anchor element matched any of ${ROOT_ANCHOR_SELECTORS.join(', ')}`);
    }

    this.registerEvent(this.app.workspace.on('file-menu', this.handleFileMenuEvent.bind(this)));
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

    const localizedTitles = new Set(localizationKeys.map((key) => activeWindow.i18next.t(key)));
    menu.items = menu.items.filter((item) => !(item instanceof MenuItem) || !localizedTitles.has(item.titleEl.textContent));
  }

  private async initFileExplorerView(): Promise<void> {
    try {
      await retryWithTimeout({
        operationFunction: async (): Promise<boolean> => {
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
    } catch (error) {
      console.error(error);
      await showErrorAndDisablePlugin(this.plugin, 'Could not initialize FileExplorerView. Disabling the plugin...');
    }
  }

  private async openContextMenu($event: Event, rootAnchorEl: HTMLElement): Promise<void> {
    const RETRY_DELAY_IN_MILLISECONDS = 100;
    await sleep(RETRY_DELAY_IN_MILLISECONDS);
    activeDocument.body.click();
    // Obsidian resolves the file as `files.get(el.parentElement)`, so it must be handed a child of the anchor.
    this.fileExplorerView?.openFileContextMenu($event, rootAnchorEl.firstElementChild as HTMLElement);
  }

  private async reloadFileExplorer(): Promise<void> {
    this.consoleDebugComponent.consoleDebug('Disabling File Explorer plugin');
    this.fileExplorerPlugin?.disable();

    this.consoleDebugComponent.consoleDebug('Enabling File Explorer plugin');
    await this.fileExplorerPlugin?.enable();
    await this.initFileExplorerView();
  }
}

function findRootAnchorEl(): HTMLElement | null {
  for (const selector of ROOT_ANCHOR_SELECTORS) {
    const element = activeDocument.querySelector<HTMLElement>(selector);
    if (element) {
      return element;
    }
  }

  return null;
}
