# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Filing an issue (for AI agents and humans)

Open issues through the [issue forms](https://github.com/mnaoumov/obsidian-root-folder-context-menu/issues/new/choose), not as blank issues.

Filing from the CLI or the API (`gh issue create --body`, or an AI agent filing for you) skips the form, and `gh issue create --template` cannot load an issue form. In that case, open the matching form in [`.github/ISSUE_TEMPLATE/`](https://github.com/mnaoumov/obsidian-root-folder-context-menu/tree/HEAD/.github/ISSUE_TEMPLATE), copy every field as a `### <label>` heading in the form's order, and fill in each one. Always state the plugin version, the Obsidian version and your operating system.

## Overview

`Root Folder Context Menu` enables the right-click context menu for the vault root folder in Obsidian's File Explorer, which Obsidian normally only offers for non-root folders. It is built on `@mnaoumov/obsidian-lib`, with `@mnaoumov/obsidian-dev-toolkit` for its tooling.

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
| Branch gate       | `npm run gate`             |
| Commit (wizard)   | `npm run commit`           |

## Architecture

- **Root config files** are thin re-exports — actual logic lives in `scripts/` (`eslint.config.mts` → `scripts/eslint-config.ts`, etc.).
- **`src/`** — plugin source:
  - `main.ts` — Obsidian entry point (default export of `Plugin`).
  - `plugin.ts` — `Plugin` extends `PluginBase`; its `onloadImpl` adds the `RootFolderContextMenuComponent` child.
  - `root-folder-context-menu-component.ts` — `LayoutReadyComponent` that disables this plugin if File Explorer is off, then subscribes to obsidian-lib's `FileExplorerRootMenuComponent` with `shouldPresentRootAsFolder: true`. The shared component owns menu interception, unsafe-root-item filtering and cross-plugin installation sharing; no File Explorer reload is needed.
    - **The root anchor is per-platform** — the shared component handles `.workspace-drawer-vault-switcher` on desktop and `.workspace-drawer-header-name` on mobile, plus the empty area below the file list. Both platforms have end-to-end suites in `plugin.desktop.integration.test.ts` / `plugin.android.integration.test.ts`.
- **`main` field** points to `src/main.ts` (Obsidian plugin source entry; built artifact is `dist/build/main.js`, not published to npm).
