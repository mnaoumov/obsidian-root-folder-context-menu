/**
 * @file
 *
 * Produces the mobile screenshots the community-store listing needs
 * (T461-P21), driving Obsidian Mobile on a real Android emulator and writing
 * `images/screenshots/screenshot-mobile-N.png`.
 *
 * This set exists because T506-P32 landed. The plugin's mobile half was broken
 * for its whole life — it anchored to `.workspace-drawer-vault-switcher`, which
 * Obsidian builds only inside `if (isDesktopApp)` — so until that fix there was
 * genuinely nothing on a phone to photograph.
 *
 * TWO shots, the same two the desktop set takes, and both raised on the empty
 * space below the file list. The mobile-only frame that looked more promising —
 * the vault name, which on a phone has no menu of its own at all — was shot and
 * then dropped for two reasons: with the plugin ON its sheet is entry-for-entry
 * the same picture as this one, and with the plugin OFF the frame is a bare
 * drawer whose one legible row is the harness's `temp-vault-<random>` name.
 * A listing image is not the place for that.
 *
 * The menu renders as a bottom SHEET here rather than a floating menu, and it
 * is anchored to the bottom of the screen, so its last row sits under the
 * caption band. `Copy path` is therefore off the bottom of both frames; the
 * assertions still check it is on the menu, and the captions never claim to
 * enumerate the entries. Neither the font size nor the staged content changes
 * the sheet's height — the rows are fixed dp.
 *
 * Every step is its own short `evalInObsidian` call: Appium's `execute/sync` is
 * capped near 30 seconds and one closure doing the whole flow times out.
 *
 * There is no mobile equivalent of the desktop viewport override, so the AVD is
 * built at exactly 900x1600 — see [[T461-P21]] for its one-time provisioning.
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
 * `App`, reduced to the font-size applier that `obsidian-typings` does not
 * declare. Setting `baseFontSize` alone changes nothing on screen.
 */
interface FontSizeApp {
  updateFontSize(this: void): void;
}

/**
 * What a long press produced: whether a menu opened, and the entries on it.
 */
interface MenuProbe {
  readonly hasMenu: boolean;
  readonly items: string[];
}

const PLUGIN_ID = 'root-folder-context-menu';
const WIDTH_IN_PIXELS = 900;
const HEIGHT_IN_PIXELS = 1600;

/**
 * Base font size for the mobile shots, below the 16px default and matching the
 * rest of the fleet. Note it does NOT govern the menu: the bottom sheet's rows
 * are fixed dp, so 11 and 13 produce the same sheet, pixel for pixel.
 */
const MOBILE_FONT_SIZE_IN_PIXELS = 13;

/**
 * The vault-name row at the top of the left drawer. The phone has no
 * `.workspace-drawer-vault-switcher` — that element is built inside
 * `if (isDesktopApp)` — so this is the anchor the plugin falls back to.
 */
const ROOT_ANCHOR_SELECTOR = '.workspace-drawer-header-name';

const NAV_FILES_CONTAINER_SELECTOR = '.nav-files-container';

/**
 * The entries only this plugin puts on the mobile root menu. Two, not the
 * desktop set's three: `Show in system explorer` is desktop-only. Asserted
 * rather than trusted, so a frame can never quietly show the opposite of its
 * caption.
 */
const PLUGIN_ONLY_ENTRIES = ['Bookmark...', 'Copy path'];

/**
 * A few staged notes and folders, so the drawer the shots are taken in looks
 * like a vault rather than an empty pane — and so there is visibly some empty
 * space BELOW the list, which is the second spot the plugin is about.
 */
const STAGED_FILES = {
  'Daily/2026-08-14.md': '# 2026-08-14\n',
  'Projects/Alpha.md': '# Alpha\n',
  'Projects/Beta.md': '# Beta\n',
  'Reading list.md': '# Reading list\n'
};

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');

beforeAll(async () => {
  const vault = getTemporaryVault();

  vault.populate(STAGED_FILES);
  await vault.syncToDevice();

  await evalInObsidian({
    async callback({ app, fontSizeInPixels }) {
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;

      app.changeTheme('obsidian');

      app.vault.setConfig('baseFontSize', fontSizeInPixels);
      const fontApp: unknown = app;
      (fontApp as FontSizeApp).updateFontSize();

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { fontSizeInPixels: MOBILE_FONT_SIZE_IN_PIXELS },
    vaultPath: vaultPath()
  });

  await openDrawer();
});

describe('mobile store screenshots', () => {
  it('1 - the full menu the plugin gives the root', async () => {
    // The vault name first, and only as an ASSERTION: it is the anchor the
    // Plugin falls back to on mobile (the desktop vault switcher does not exist
    // Here), so it is the thing a phone could plausibly get wrong. It is not
    // Photographed — its sheet is entry-for-entry the frame below.
    const anchorMenu = await longPress(ROOT_ANCHOR_SELECTOR);
    expect(anchorMenu.hasMenu).toBe(true);

    // Photographed LAST, so the frame is this menu rather than the one above.
    const result = await longPress(NAV_FILES_CONTAINER_SELECTOR);
    expect(result.hasMenu).toBe(true);
    for (const entry of PLUGIN_ONLY_ENTRIES) {
      expect(result.items).toContain(entry);
    }

    await shoot(1, 'Long-press below your files: the root gets a folder\'s menu');
  });

  it('2 - the same long press without the plugin', async () => {
    // Second, not first: the reader has to have seen the full menu before a
    // Shorter one means anything. Obsidian does offer a few entries here on its
    // Own, so the contrast is four entries against six rather than a menu
    // Against nothing.
    await dismissMenu();
    await setPluginEnabled(false);

    try {
      const result = await longPress(NAV_FILES_CONTAINER_SELECTOR);
      for (const entry of PLUGIN_ONLY_ENTRIES) {
        expect(result.items).not.toContain(entry);
      }

      await shoot(2, 'Without it: only the few entries Obsidian offers');
    } finally {
      await setPluginEnabled(true);
    }
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
 * Long-presses the element the given selector matches and reports the menu it
 * raised. A long press reaches the page as a `contextmenu` event, which is the
 * event the plugin listens for.
 *
 * @param selector - The element to long-press.
 * @returns Whether a menu opened, and the entries it carried.
 */
async function longPress(selector: string): Promise<MenuProbe> {
  await dismissMenu();

  return await evalInObsidian({
    async callback({ lib: { waitUntil }, selector: targetSelector }) {
      const MENU_TIMEOUT_IN_MILLISECONDS = 5000;
      const SETTLE_DELAY_IN_MILLISECONDS = 900;
      const CAPTURE_SETTLE_DELAY_IN_MILLISECONDS = 2000;
      const HALF = 2;

      // Let the previous shot's capture settle: the metrics the capture sets
      // And clears tear down a menu opened too soon afterwards.
      await sleep(CAPTURE_SETTLE_DELAY_IN_MILLISECONDS);

      // The drawer SLIDES, and a row read mid-animation is still off the left
      // Edge at zero width — a menu anchored to that lands off screen.
      const element = [...document.querySelectorAll(targetSelector)]
        .find((candidate) => candidate.getBoundingClientRect().width > 0);
      if (!(element instanceof HTMLElement)) {
        throw new TypeError(`Nothing on screen matched ${targetSelector}.`);
      }

      // Untrusted by necessity: the trusted `clickMouse` the desktop twin uses is built on
      // `window.electron`, which does not exist on the phone. The isTrusted-gated half of
      // Obsidian's contextmenu handling is therefore covered by the desktop suite alone.
      const rect = element.getBoundingClientRect();
      element.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: Math.round(rect.left + rect.width / HALF),
          clientY: Math.round(rect.top + rect.height / HALF)
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
      // Inert and the frames become the same picture.
      app.workspace.trigger('layout-change');

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { isEnabled, pluginId: PLUGIN_ID },
    vaultPath: vaultPath()
  });
}

/**
 * Captures the window, captions it, and writes it as
 * `images/screenshots/screenshot-mobile-<index>.png`.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 */
async function shoot(index: number, caption: string): Promise<void> {
  const captured = await captureObsidianScreenshot({ vaultPath: vaultPath() });

  // The AVD is 900x1600, so the device frame IS the store size. Asserting it
  // Here is what keeps that true: run this against any other AVD and it fails
  // Loudly instead of quietly shipping an off-spec image.
  expect(readPngDimensions(captured)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  const labeled = await labelScreenshot(captured, { text: caption });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-mobile-${String(index)}.png`), labeled);
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
