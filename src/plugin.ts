import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';

import { RootFolderContextMenuComponent } from './root-folder-context-menu-component.ts';

export class Plugin extends PluginBase {
  protected override onloadImpl(): void {
    this.addChild(
      new RootFolderContextMenuComponent({
        app: this.app,
        consoleDebugComponent: this.consoleDebugComponent,
        pluginId: this.manifest.id
      })
    );
  }
}
