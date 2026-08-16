/**
 * @file
 *
 * Drives the plugin's actual behavior on a real Android device (T506-P32).
 *
 * This suite exists because the mobile half was broken for its whole life and
 * nothing noticed: the plugin anchored its menu to
 * `.workspace-drawer-vault-switcher`, which Obsidian builds only inside
 * `if (isDesktopApp)`, so on a phone the `querySelector` returned `null` — and
 * because the second hook is nested inside the first, both listeners died at
 * once. A unit test cannot catch that; only a device can.
 *
 * The entries asserted here were read OFF the device rather than copied from
 * the desktop suite: `Show in system explorer` does not exist on a phone, so
 * the mobile contribution is two entries, not three.
 *
 * Every step is its own short `evalInObsidian` call — Appium's `execute/sync`
 * is capped near 30 seconds and one closure doing the whole flow times out.
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
 * What a long-press produced: whether a menu opened, and the entries on it.
 */
interface MenuProbe {
  readonly hasMenu: boolean;
  readonly items: string[];
}

const PLUGIN_ID = 'root-folder-context-menu';

/**
 * The vault-name row at the top of the left drawer. The phone has no
 * `.workspace-drawer-vault-switcher` — that element is built inside
 * `if (isDesktopApp)` — so this is the anchor the plugin falls back to.
 */
const ROOT_ANCHOR_SELECTOR = '.workspace-drawer-header-name';

const NAV_FILES_CONTAINER_SELECTOR = '.nav-files-container';

/**
 * The entries only this plugin puts on the mobile root menu. Two, not the
 * desktop set's three: `Show in system explorer` is desktop-only.
 */
const PLUGIN_ONLY_ENTRIES = ['Bookmark...', 'Copy path'];

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
  await openDrawer();
});

describe('root context menu on Android', () => {
  it('should give the vault name a menu it otherwise has none of', async () => {
    const result = await openContextMenuOn(ROOT_ANCHOR_SELECTOR);

    expect(result.hasMenu).toBe(true);
    for (const entry of PLUGIN_ONLY_ENTRIES) {
      expect(result.items).toContain(entry);
    }
  });

  it('should keep the entries that make no sense for the root off that menu', async () => {
    const filteredTitles = await localizedTitles(FILTERED_ENTRY_KEYS);
    const folderMenu = await openContextMenuOn(`.nav-folder-title[data-path="${STAGED_FOLDER_PATH}"]`);

    // An ordinary folder's menu carries every one of them, which is what makes
    // Their absence from the root's menu mean something rather than being
    // Vacuously true of titles this Obsidian never renders.
    for (const title of filteredTitles) {
      expect(folderMenu.items).toContain(title);
    }

    const rootMenu = await openContextMenuOn(ROOT_ANCHOR_SELECTOR);

    for (const title of filteredTitles) {
      expect(rootMenu.items).not.toContain(title);
    }
  });

  it('should give the empty area below the file list the same entries', async () => {
    const result = await openContextMenuOn(NAV_FILES_CONTAINER_SELECTOR);

    expect(result.hasMenu).toBe(true);
    for (const entry of PLUGIN_ONLY_ENTRIES) {
      expect(result.items).toContain(entry);
    }
  });

  it('should contribute nothing once disabled', async () => {
    await setPluginEnabled(false);

    try {
      // On a phone the vault-name row has NO menu of its own, so here the
      // Plugin's contribution really is the whole menu rather than a few extra
      // Entries — unlike the file list below, where Obsidian offers four.
      const anchorMenu = await openContextMenuOn(ROOT_ANCHOR_SELECTOR);
      expect(anchorMenu.hasMenu).toBe(false);

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

      // `pressKey` is Electron-only, so the phone needs a synthetic event.
      // Obsidian listens for keys on `document`, so this dismisses exactly as a
      // Real key would.
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
 * Long-presses the element the given selector matches and reports the menu it
 * raised. A long press reaches the page as a `contextmenu` event, which is the
 * event the plugin listens for.
 *
 * @param selector - The element to long-press.
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
 * Opens the phone's left drawer, where the vault name and the file list live.
 */
async function openDrawer(): Promise<void> {
  await evalInObsidian({
    async callback({ app, lib: { waitUntil } }) {
      const DRAWER_TIMEOUT_IN_MILLISECONDS = 20_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      // `collapsed` lies: it reads false while the drawer element is still
      // `display: none`, and `expand()` is then a no-op that returns happily
      // And shows nothing. Toggling is what re-runs the code that displays it.
      app.workspace.leftSplit.collapse();
      app.workspace.leftSplit.expand();

      const fileExplorerLeaf = app.workspace.getLeavesOfType('file-explorer')[0];
      if (fileExplorerLeaf) {
        await app.workspace.revealLeaf(fileExplorerLeaf);
      }

      // The drawer SLIDES, so it is measured rather than assumed: a row read
      // Mid-animation is still off the left edge at zero width.
      await waitUntil({
        message: 'the left drawer to finish sliding open',
        predicate: () => [...document.querySelectorAll('.nav-files-container .nav-file')].some((row) => row.getBoundingClientRect().width > 0),
        timeoutInMilliseconds: DRAWER_TIMEOUT_IN_MILLISECONDS
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
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
