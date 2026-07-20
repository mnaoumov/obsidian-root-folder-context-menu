import type { App } from 'obsidian';

import { Notice } from 'obsidian';
import {
  enableCommunityPlugin,
  installCommunityPlugin
} from 'obsidian-dev-utils/obsidian/community-plugins';

// Root Folder Context Menu adds a right-click context menu to the vault root folder (and the
// empty area of the File Explorer). There is nothing for a code-button to drive - the demo
// notes walk through it manually. The only helper the vault needs is the shared CodeScript
// Toolkit installer used by the prerequisite note's button.
export async function installAndEnable(app: App, pluginId: string): Promise<void> {
  await installCommunityPlugin({ app, pluginId });
  await enableCommunityPlugin({ app, pluginId });
  new Notice(`Installed and enabled: ${pluginId}`);
}
