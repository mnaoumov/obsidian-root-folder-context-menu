import { OpenDemoVaultCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/open-demo-vault-command-handler';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';

import { RootFolderContextMenuComponent } from './root-folder-context-menu-component.ts';

export class Plugin extends PluginBase {
  protected override onloadImpl(): void {
    this.addChild(
      new RootFolderContextMenuComponent({
        app: this.app,
        consoleDebugComponent: this.consoleDebugComponent,
        plugin: this
      })
    );
    this.commandHandlerComponent.registerCommandHandlers(() => [
      new OpenDemoVaultCommandHandler({
        app: this.app,
        pluginId: this.manifest.id,
        pluginNoticeComponent: this.pluginNoticeComponent,
        pluginVersion: this.manifest.version
      })
    ]);
  }
}
