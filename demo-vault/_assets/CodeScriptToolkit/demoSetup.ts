import type {
  App,
  Menu,
  TAbstractFile
} from 'obsidian';

import { Notice } from 'obsidian';

// No library import on purpose: CodeScript Toolkit resolves only obsidian and its own bundled modules inside
// the vault, so these helpers talk to Obsidian's plugin manager directly.

const PLUGIN_ID = 'root-folder-context-menu';
const FILLER_FOLDER_PATH = 'Materials/02 Empty area context menu';
const FILLER_NOTE_COUNT = 8;
const ROOT_MENU_TIMEOUT_IN_MILLISECONDS = 3000;

// The vault-name row the plugin hangs the root menu on, in the order the plugin itself tries them: the
// vault switcher at the bottom of the desktop sidebar, then the drawer header on mobile.
const ROOT_ANCHOR_SELECTORS = [
  '.workspace-drawer-vault-switcher',
  '.workspace-drawer-header-name'
];

/**
 * Turns the plugin off, so the reader can right-click the same spot and see what Obsidian offers on
 * its own — which is the honest comparison, since those spots are not menu-less, just sparse.
 *
 * Manual equivalent: toggle **`Root Folder Context Menu`** off in **Settings -> Community plugins**.
 */
export async function disablePlugin(app: App): Promise<void> {
  await app.plugins.disablePluginAndSave(PLUGIN_ID);
  new Notice('Plugin off. Right-click the vault-name row and count the entries.');
}

/**
 * Turns the plugin back on.
 *
 * Manual equivalent: toggle **`Root Folder Context Menu`** back on in **Settings -> Community plugins**.
 */
export async function enablePlugin(app: App): Promise<void> {
  await app.plugins.enablePluginAndSave(PLUGIN_ID);
  new Notice('Plugin on. Right-click the same spot again — the menu is fuller.');
}

/**
 * Opens the File Explorer and right-clicks the vault root, so the reader sees the menu the plugin gives it.
 *
 * Throws unless Obsidian builds the folder menu for the root `/`: that is what the plugin adds, and a
 * menu of Obsidian's own on the same row does not count.
 *
 * Manual equivalent: right-click the vault-name row at the bottom of the File Explorer (long-press the
 * vault name at the top of the left drawer on mobile).
 */
export async function openRootFolderContextMenu(app: App): Promise<void> {
  if (!app.plugins.enabledPlugins.has(PLUGIN_ID)) {
    throw new Error('`Root Folder Context Menu` is off. Turn it on first, then try again.');
  }

  app.workspace.leftSplit.expand();
  const fileExplorerLeaf = app.workspace.getLeavesOfType('file-explorer')[0];
  if (fileExplorerLeaf) {
    await app.workspace.revealLeaf(fileExplorerLeaf);
  }

  const anchorEl = ROOT_ANCHOR_SELECTORS
    .map((selector) => activeDocument.querySelector<HTMLElement>(selector))
    .find((element) => element !== null);
  if (!anchorEl) {
    throw new Error('Could not find the vault-name row in the File Explorer.');
  }

  let resolveRootMenu: (isRootMenu: boolean) => void = () => undefined;
  const rootMenuPromise = new Promise<boolean>((resolve) => {
    resolveRootMenu = resolve;
  });
  function handleFileMenu(_menu: Menu, file: TAbstractFile): void {
    if (file.path === '/') {
      resolveRootMenu(true);
    }
  }
  app.workspace.on('file-menu', handleFileMenu);

  try {
    // A dispatched right-click is enough here: the file explorer's `contextmenu` path does not check
    // `event.isTrusted`, and the plugin positions the menu from the event's coordinates.
    const rect = anchorEl.getBoundingClientRect();
    anchorEl.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        button: 2,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      })
    );

    const isRootMenu = await Promise.race([
      rootMenuPromise,
      sleep(ROOT_MENU_TIMEOUT_IN_MILLISECONDS).then(() => false)
    ]);
    if (!isRootMenu) {
      throw new Error('The vault root menu did not open.');
    }
  } finally {
    app.workspace.off('file-menu', handleFileMenu);
  }

  new Notice('This is the vault root menu. Try New note or New folder.');
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
