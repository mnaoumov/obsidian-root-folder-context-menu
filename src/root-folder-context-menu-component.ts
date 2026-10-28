import type { App } from 'obsidian';

import { FileExplorerRootMenuComponent } from '@mnaoumov/obsidian-lib/components/file-explorer-root-menu-component';
import { LayoutReadyComponent } from '@mnaoumov/obsidian-lib/components/layout-ready-component';
import { showErrorAndDisablePlugin } from '@mnaoumov/obsidian-lib/plugin/plugin';
import { noop } from '@mnaoumov/typescript-lib/function';
import { InternalPluginName } from '@obsidian-typings/obsidian-public-latest/implementations';

import type { Plugin } from './plugin.ts';

interface RootFolderContextMenuComponentConstructorParams {
  readonly app: App;
  readonly plugin: Plugin;
}

export class RootFolderContextMenuComponent extends LayoutReadyComponent {
  private readonly plugin: Plugin;

  public constructor(params: RootFolderContextMenuComponentConstructorParams) {
    super(params.app);
    this.plugin = params.plugin;
  }

  protected override async onLayoutReady(): Promise<void> {
    if (!this.app.internalPlugins.getEnabledPluginById(InternalPluginName.FileExplorer)) {
      await showErrorAndDisablePlugin(this.plugin, 'File Explorer plugin is disabled. Disabling the plugin...');
      return;
    }

    this.addChild(
      new FileExplorerRootMenuComponent({
        app: this.app,
        handler: noop,
        shouldPresentRootAsFolder: true
      })
    );
  }
}
