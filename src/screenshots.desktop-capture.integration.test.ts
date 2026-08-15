/**
 * @file
 *
 * Produces the desktop screenshots the community-store listing needs
 * (T461-P21), driving a real Obsidian and writing
 * `images/screenshots/screenshot-desktop-N.png`.
 *
 * TWO shots, not five. This plugin fills out a context menu Obsidian only
 * partly provides, and the shot count is a ceiling rather than a quota.
 *
 * The order is deliberate. The listing leads with the FIX, because the "before"
 * state is a SHORTER menu — Obsidian does offer four entries of its own on the
 * empty area below the file list — and a four-entry menu means nothing until the
 * seven-entry one has been seen.
 *
 * DESKTOP ONLY. The plugin also hooks the vault name at the top of the mobile
 * drawer, but it looks for `.workspace-drawer-vault-switcher` and current
 * Obsidian Mobile renders that element as `workspace-drawer-header-switcher`, so
 * the hook attaches to nothing. Pressing the file list on a phone yields
 * Obsidian's own menu carrying none of the entries this plugin adds. Raised
 * separately — there is no mobile behavior left to photograph.
 *
 * Both shots assert what they claim — that the menu is there, and that it is
 * not — so a frame can never quietly show the opposite of its caption.
 */

import {
  mkdirSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import {
  captureObsidianScreenshot,
  evalInObsidian,
  labelScreenshot,
  readPngDimensions
} from 'obsidian-integration-testing';
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
const WIDTH_IN_PIXELS = 1200;
const HEIGHT_IN_PIXELS = 800;

/**
 * A few staged notes and folders, so the file explorer the shots are taken in
 * looks like a vault rather than an empty pane — and so there is visibly some
 * empty space BELOW the list, which is the spot the plugin is about.
 */
const STAGED_FILES = {
  'Daily/2026-08-14.md': '# 2026-08-14\n',
  'Projects/Alpha.md': '# Alpha\n',
  'Projects/Beta.md': '# Beta\n',
  'Reading list.md': '# Reading list\n'
};

/**
 * The entries only this plugin puts on the root menu. Obsidian offers four of
 * its own there (`New note`, `New folder`, `New canvas`, `New base`), so these
 * are what the before/after actually turns on — asserted rather than trusted,
 * so a frame can never quietly show the opposite of its caption.
 */
const PLUGIN_ONLY_ENTRIES = ['Bookmark...', 'Copy path', 'Show in system explorer'];

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');

beforeAll(async () => {
  const vault = getTemporaryVault();

  vault.populate(STAGED_FILES);
  await vault.syncToDevice();

  await evalInObsidian({
    async callback({ app, lib: { waitUntil } }) {
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 30_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;

      app.changeTheme('obsidian');

      // The file explorer IS the subject here, so it is the one thing that must
      // Be open — the opposite of every other plugin's shots, which collapse it.
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

describe('desktop store screenshots', () => {
  it('1 - the full menu the plugin gives the root', async () => {
    const result = await rightClickBelowTheFiles();
    for (const entry of PLUGIN_ONLY_ENTRIES) {
      expect(result.items).toContain(entry);
    }
    await shoot(1, 'The vault root gets the same menu any folder has');
  });

  it('2 - the same right-click without the plugin', async () => {
    // Second, not first: the reader has to have seen the full menu before a
    // Shorter one means anything. Obsidian does offer a few entries here on its
    // Own, so the contrast is four entries against seven rather than a menu
    // Against nothing.
    await dismissMenu();
    await setPluginEnabled(false);
    const result = await rightClickBelowTheFiles();
    for (const entry of PLUGIN_ONLY_ENTRIES) {
      expect(result.items).not.toContain(entry);
    }
    await shoot(2, 'Without it: only the few entries Obsidian offers');
    await setPluginEnabled(true);
  });
});

/**
 * Closes any menu left open by a previous shot.
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
 * Right-clicks the empty area below the file list — the spot the plugin is
 * about — and reports whether a menu came up.
 *
 * @returns Whether a menu opened, and the entries it carried.
 */
async function rightClickBelowTheFiles(): Promise<MenuProbe> {
  return await evalInObsidian({
    async callback({ lib: { waitUntil } }) {
      const MENU_SETTLE_TIMEOUT_IN_MILLISECONDS = 3000;
      const SETTLE_DELAY_IN_MILLISECONDS = 900;
      const BELOW_LAST_FILE_OFFSET_IN_PIXELS = 40;

      const container = document.querySelector('.nav-files-container');
      if (!(container instanceof HTMLElement)) {
        throw new TypeError('The file explorer is not on screen.');
      }

      const files = [...container.querySelectorAll('.nav-file')];
      const lastFile = files.at(-1);
      const containerRect = container.getBoundingClientRect();
      const lastFileRect = lastFile?.getBoundingClientRect();

      // Below the last file but inside the container: that empty strip is the
      // Exact spot the plugin gives a menu to, and clicking a FILE instead
      // Would photograph Obsidian's ordinary file menu.
      const clientY = (lastFileRect?.bottom ?? containerRect.top) + BELOW_LAST_FILE_OFFSET_IN_PIXELS;

      container.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: Math.round(containerRect.left + containerRect.width / 2),
          clientY: Math.round(clientY)
        })
      );

      // A short wait either way: this is used BOTH to show a menu appearing and
      // To show one not appearing, so a timeout here is a legitimate outcome
      // Rather than a failure.
      try {
        await waitUntil({
          message: 'the root context menu to open',
          predicate: () => Boolean(document.body.querySelector('.menu')),
          timeoutInMilliseconds: MENU_SETTLE_TIMEOUT_IN_MILLISECONDS
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
    vaultPath: vaultPath()
  });
}

/**
 * Enables or disables the plugin, for the shot that shows what its absence
 * leaves behind.
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
      // Inert and the two frames become the same picture.
      app.workspace.trigger('layout-change');

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { isEnabled, pluginId: PLUGIN_ID },
    vaultPath: vaultPath()
  });
}

/**
 * Captures the window, captions it, and writes it as
 * `images/screenshots/screenshot-desktop-<index>.png`.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 */
async function shoot(index: number, caption: string): Promise<void> {
  const bytes = await captureObsidianScreenshot({
    heightInPixels: HEIGHT_IN_PIXELS,
    vaultPath: vaultPath(),
    widthInPixels: WIDTH_IN_PIXELS
  });

  const labeled = await labelScreenshot(bytes, { text: caption });

  expect(readPngDimensions(labeled)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-desktop-${String(index)}.png`), labeled);
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
