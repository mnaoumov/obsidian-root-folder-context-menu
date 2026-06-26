# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Root Folder Context Menu enables the right-click context menu for the vault root folder in Obsidian's File Explorer, which Obsidian normally only offers for non-root folders. It is built on `obsidian-dev-utils`.

## Commands

| Task              | Command                    |
|-------------------|----------------------------|
| TypeScript check  | `npm run build:compile`    |
| Build             | `npm run build`            |
| Dev (watch)       | `npm run dev`              |
| Lint              | `npm run lint`             |
| Lint (fix)        | `npm run lint:fix`         |
| Format            | `npm run format`           |
| Format (check)    | `npm run format:check`     |
| Spellcheck        | `npm run spellcheck`       |
| Markdown lint     | `npm run lint:md`          |
| Markdown lint fix | `npm run lint:md:fix`      |
| Unit tests        | `npm test`                 |
| Coverage          | `npm run test:coverage`    |
| Integration tests | `npm run test:integration` |
| Commit (wizard)   | `npm run commit`           |

## Architecture

- **Root config files** are thin re-exports — actual logic lives in `scripts/` (`eslint.config.mts` → `scripts/eslint-config.ts`, etc.).
- **`src/`** — plugin source:
  - `main.ts` — Obsidian entry point (default export of `Plugin`).
  - `plugin.ts` — `Plugin` extends `PluginBase`; its `onloadImpl` adds the `RootFolderContextMenuComponent` child.
  - `root-folder-context-menu-component.ts` — `LayoutReadyComponent` holding the core logic: resolves the File Explorer plugin/view (disabling itself if File Explorer is off), wires `contextmenu` handlers on the vault-switcher and nav-files container, filters disallowed items (move/delete/copy/rename/search) out of the root folder's `file-menu`, and reloads the File Explorer.
  - `patches/file-explorer-view-open-file-context-menu-patch-component.ts` — `MonkeyAroundComponent` that monkey-patches `FileExplorerView.openFileContextMenu` so the root `TFolder` is temporarily treated as non-root, making Obsidian build the context menu for it.
- **`main` field** points to `src/main.ts` (Obsidian plugin source entry; built artifact is `dist/build/main.js`, not published to npm).

## Known Issues

None.
