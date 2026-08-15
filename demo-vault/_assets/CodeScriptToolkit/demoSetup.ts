import type { App } from 'obsidian';

import { Notice } from 'obsidian';
import {
  disableCommunityPlugin,
  enableCommunityPlugin
} from 'obsidian-dev-utils/obsidian/community-plugins';

const PLUGIN_ID = 'root-folder-context-menu';
const FILLER_FOLDER_PATH = 'Materials/02 Empty area context menu';
const FILLER_NOTE_COUNT = 8;

/**
 * Turns the plugin off, so the reader can right-click the same spot and see what Obsidian offers on
 * its own — which is the honest comparison, since those spots are not menu-less, just sparse.
 *
 * Manual equivalent: toggle **Root Folder Context Menu** off in **Settings -> Community plugins**.
 */
export async function disablePlugin(app: App): Promise<void> {
  await disableCommunityPlugin({ app, pluginId: PLUGIN_ID });
  new Notice('Plugin off. Right-click the vault-name row and count the entries.');
}

/**
 * Turns the plugin back on.
 *
 * Manual equivalent: toggle **Root Folder Context Menu** back on in **Settings -> Community plugins**.
 */
export async function enablePlugin(app: App): Promise<void> {
  await enableCommunityPlugin({ app, pluginId: PLUGIN_ID });
  new Notice('Plugin on. Right-click the same spot again — the menu is fuller.');
}

/**
 * Creates enough notes to push the file list past the height of the pane.
 *
 * `02 Empty area context menu.md` needs blank space below the last file to right-click, and a vault
 * this small does not have any — the note used to just tell the reader to go and make some.
 *
 * Manual equivalent: create any handful of notes until the file list fills the pane.
 */
export async function fillFileList(app: App): Promise<void> {
  if (!await app.vault.adapter.exists(FILLER_FOLDER_PATH)) {
    await app.vault.createFolder(FILLER_FOLDER_PATH);
  }

  for (let index = 1; index <= FILLER_NOTE_COUNT; index++) {
    const path = `${FILLER_FOLDER_PATH}/Filler ${String(index).padStart(2, '0')}.md`;
    if (!app.vault.getFileByPath(path)) {
      await app.vault.create(path, `# Filler ${String(index)}\n\nHere only to give the file list some height.\n`);
    }
  }

  new Notice(`Created ${String(FILLER_NOTE_COUNT)} filler notes. Scroll the File Explorer to the bottom.`);
}

/**
 * Deletes the filler notes again.
 *
 * Manual equivalent: delete the `Materials/02 Empty area context menu` folder.
 */
export async function removeFillerNotes(app: App): Promise<void> {
  const folder = app.vault.getFolderByPath(FILLER_FOLDER_PATH);
  if (folder) {
    await app.fileManager.trashFile(folder);
  }
  new Notice('Filler notes removed.');
}
