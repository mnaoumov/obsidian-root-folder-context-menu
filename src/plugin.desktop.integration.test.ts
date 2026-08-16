/**
 * @file
 *
 * Drives the plugin's actual behavior in a real desktop Obsidian: the vault
 * root, which Obsidian gives only a short menu of its own, gets the full folder
 * menu on both of the spots this plugin hooks.
 *
 * The suite exists because the desktop hook can break exactly as silently as
 * the mobile one did (T506-P32): the anchor is resolved by a `querySelector`
 * that returns `null` the moment Obsidian renames or moves the element, and
 * nothing else in the repo would notice.
 */

import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

/**
 * What a right-click produced: whether a menu opened, and the entries on it.
 */
interface MenuProbe {
  readonly hasMenu: boolean;
  readonly items: string[];
}

const PLUGIN_ID = 'root-folder-context-menu';

/**
 * The vault-name row at the bottom of the left sidebar. Obsidian builds it
 * inside `if (isDesktopApp)`, which is why the mobile half needs its own anchor.
 */
const ROOT_ANCHOR_SELECTOR = '.workspace-drawer-vault-switcher';

const NAV_FILES_CONTAINER_SELECTOR = '.nav-files-container';

/**
 * The entries only this plugin puts on the root menu. Obsidian offers four of
 * its own there (`New note`, `New folder`, `New canvas`, `New base`), so the
 * plugin's contribution is these rather than the menu's existence.
 */
const PLUGIN_ONLY_ENTRIES = ['Bookmark...', 'Copy path', 'Show in system explorer'];

/**
 * The one of those that is unambiguously the plugin's ON THE VAULT-NAME ROW.
 * Obsidian gives that row a two-entry menu of its own — `Copy path` and
 * `Show in system explorer` — so their presence there proves nothing. The empty
 * area below the file list is the opposite: Obsidian offers only its four
 * `New ...` entries, so all three above are the plugin's doing.
 */
const PLUGIN_ONLY_ANCHOR_ENTRY = 'Bookmark...';

/**
 * The entries the plugin deliberately strips back out of the root menu, because
 * they make no sense for the vault root — it cannot be renamed, moved, copied
 * or deleted. Named by localization key rather than by English title, exactly as
 * the implementation does, so the assertion holds whatever locale the host runs
 * in.
 */
const FILTERED_ENTRY_KEYS = [
  'plugins.file-explorer.action-move-folder',
  'plugins.file-explorer.menu-opt-delete',
  'plugins.file-explorer.menu-opt-make-copy',
  'plugins.file-explorer.menu-opt-rename',
  'plugins.search.menu-opt-search-in-folder'
];

/**
 * An ordinary folder, used as the control: whatever the root's menu is missing
 * has to be present here, or the assertion proves nothing.
 */
const STAGED_FOLDER_PATH = 'Projects';

const STAGED_FILES = {
  'Daily/2026-08-14.md': '# 2026-08-14\n',
  'Projects/Alpha.md': '# Alpha\n',
  'Projects/Beta.md': '# Beta\n',
  'Reading list.md': '# Reading list\n'
};

beforeAll(async () => {
  const vault = getTemporaryVault();
  vault.populate(STAGED_FILES);
  await vault.syncToDevice();

  await evalInObsidian({
    async callback({ app, lib: { waitUntil } }) {
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 30_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;

      // The file explorer IS the subject here, so it is the one thing that must
      // Be open.
      app.workspace.leftSplit.expand();
      const fileExplorerLeaf = app.workspace.getLeavesOfType('file-explorer')[0];
      if (fileExplorerLeaf) {
        await app.workspace.revealLeaf(fileExplorerLeaf);
      }

      await waitUntil({
        message: 'the file explorer to list the staged files',
        predicate: () => document.querySelectorAll('.nav-files-container .nav-file').length > 0,
        timeoutInMilliseconds: SETTLE_TIMEOUT_IN_MILLISECONDS
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    vaultPath: vaultPath()
  });
});

describe('root context menu on desktop', () => {
  it('should give the vault name the full folder menu', async () => {
    const result = await openContextMenuOn(ROOT_ANCHOR_SELECTOR);

    expect(result.hasMenu).toBe(true);
    for (const entry of PLUGIN_ONLY_ENTRIES) {
      expect(result.items).toContain(entry);
    }
  });

  it('should give the root the same menu an ordinary folder has, minus what makes no sense for it', async () => {
    const filteredTitles = await localizedTitles(FILTERED_ENTRY_KEYS);
    const folderMenu = await openContextMenuOn(`.nav-folder-title[data-path="${STAGED_FOLDER_PATH}"]`);
    const rootMenu = await openContextMenuOn(ROOT_ANCHOR_SELECTOR);

    // An ordinary folder's menu really does carry every one of them, which is
    // What makes their absence from the root's menu mean something rather than
    // Being vacuously true of titles this Obsidian never renders.
    for (const title of filteredTitles) {
      expect(folderMenu.items).toContain(title);
      expect(rootMenu.items).not.toContain(title);
    }

    // And everything else that folder offers is on the root's menu too. That is
    // The plugin's whole claim, asserted as the README states it rather than as
    // A hand-listed set of entries that would drift from it.
    const survivingTitles = folderMenu.items.filter((item) => !filteredTitles.includes(item));
    for (const title of survivingTitles) {
      expect(rootMenu.items).toContain(title);
    }
  });

  it('should give the empty area below the file list the same menu', async () => {
    const result = await openContextMenuOn(NAV_FILES_CONTAINER_SELECTOR);

    expect(result.hasMenu).toBe(true);
    for (const entry of PLUGIN_ONLY_ENTRIES) {
      expect(result.items).toContain(entry);
    }
  });

  it('should contribute nothing once disabled', async () => {
    await setPluginEnabled(false);

    try {
      // The assertion is on the plugin's OWN entries, not on the menu being
      // Absent: Obsidian offers a few of its own at both spots either way, so
      // "no menu" would be the wrong thing to demand.
      const anchorMenu = await openContextMenuOn(ROOT_ANCHOR_SELECTOR);
      expect(anchorMenu.items).not.toContain(PLUGIN_ONLY_ANCHOR_ENTRY);

      const containerMenu = await openContextMenuOn(NAV_FILES_CONTAINER_SELECTOR);
      for (const entry of PLUGIN_ONLY_ENTRIES) {
        expect(containerMenu.items).not.toContain(entry);
      }
    } finally {
      await setPluginEnabled(true);
    }
  });
});

/**
 * Closes any menu left open by a previous test.
 */
async function dismissMenu(): Promise<void> {
  await evalInObsidian({
    async callback({ lib: { waitUntil } }) {
      const MENU_TIMEOUT_IN_MILLISECONDS = 15_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 600;

      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
      document.body.click();

      await waitUntil({
        message: 'the menu to close',
        predicate: () => !document.body.querySelector('.menu'),
        timeoutInMilliseconds: MENU_TIMEOUT_IN_MILLISECONDS
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    vaultPath: vaultPath()
  });
}

/**
 * Resolves localization keys to the titles this Obsidian actually renders.
 *
 * @param keys - The localization keys to resolve.
 * @returns The localized titles, in the same order.
 */
async function localizedTitles(keys: string[]): Promise<string[]> {
  return await evalInObsidian({
    callback({ keys: localizationKeys }) {
      return localizationKeys.map((key) => activeWindow.i18next.t(key));
    },
    input: { keys },
    vaultPath: vaultPath()
  });
}

/**
 * Right-clicks the element the given selector matches and reports the menu it
 * raised.
 *
 * @param selector - The element to right-click.
 * @returns Whether a menu opened, and the entries it carried.
 */
async function openContextMenuOn(selector: string): Promise<MenuProbe> {
  await dismissMenu();

  return await evalInObsidian({
    async callback({ lib: { waitUntil }, selector: targetSelector }) {
      const MENU_TIMEOUT_IN_MILLISECONDS = 5000;
      const SETTLE_DELAY_IN_MILLISECONDS = 900;

      const element = document.querySelector(targetSelector);
      if (!(element instanceof HTMLElement)) {
        throw new TypeError(`No element matched ${targetSelector}.`);
      }

      const rect = element.getBoundingClientRect();
      element.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: Math.round(rect.left + rect.width / 2),
          clientY: Math.round(rect.top + rect.height / 2)
        })
      );

      // A short wait either way: this is used BOTH to show a menu appearing and
      // To show one not appearing, so a timeout here is a legitimate outcome
      // Rather than a failure.
      try {
        await waitUntil({
          message: 'the root context menu to open',
          predicate: () => Boolean(document.body.querySelector('.menu')),
          timeoutInMilliseconds: MENU_TIMEOUT_IN_MILLISECONDS
        });
      } catch {
        // Left deliberately empty — see above.
      }

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      const menu = document.body.querySelector('.menu');
      return {
        hasMenu: Boolean(menu),
        items: [...menu?.querySelectorAll('.menu-item-title') ?? []].map((item) => item.textContent)
      };
    },
    input: { selector },
    vaultPath: vaultPath()
  });
}

/**
 * Enables or disables the plugin.
 *
 * @param isEnabled - Whether the plugin should be on.
 */
async function setPluginEnabled(isEnabled: boolean): Promise<void> {
  await evalInObsidian({
    async callback({ app, isEnabled: shouldEnable, pluginId }) {
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      if (shouldEnable) {
        await app.plugins.enablePlugin(pluginId);
      } else {
        await app.plugins.disablePlugin(pluginId);
      }

      // The plugin wires its listener once the layout is ready, so a plugin
      // Re-enabled mid-session needs the event to arrive again or it sits there
      // Inert.
      app.workspace.trigger('layout-change');

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { isEnabled, pluginId: PLUGIN_ID },
    vaultPath: vaultPath()
  });
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
