# Root Folder Context Menu

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/mnaoumov)
[![GitHub release](https://img.shields.io/github/v/release/mnaoumov/obsidian-root-folder-context-menu)](https://github.com/mnaoumov/obsidian-root-folder-context-menu/releases)
[![GitHub downloads](https://img.shields.io/github/downloads/mnaoumov/obsidian-root-folder-context-menu/total)](https://github.com/mnaoumov/obsidian-root-folder-context-menu/releases)
[![Coverage: 100%](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/mnaoumov/obsidian-root-folder-context-menu)

Every folder in [Obsidian](https://obsidian.md/)'s File Explorer has a right-click menu — every folder
except the one you use most. The **vault root** has none, and neither does the **empty area** below the
file list, so creating a note at the top level means creating it somewhere else and moving it, or
reaching for the ribbon.

This plugin gives both spots the same context menu any other folder gets, minus the entries that
cannot apply to the vault itself.

## Demo vault

**The documentation is a demo vault.** Each feature has a note that explains what it does and why you
would want it, with a sample folder to create things next to.

**[Start reading here](<./demo-vault/00 Start.md>)** — it is plain markdown, so it works on GitHub with
nothing installed.

A copy of the vault ships with every release. You can access it via any of the following:

1. Running the **Root Folder Context Menu: Open demo vault** command.
2. Downloading `root-folder-context-menu-demo-vault-<version>.zip` (`<version>` is the release version) from the [Releases](https://github.com/mnaoumov/obsidian-root-folder-context-menu/releases).
3. Browsing its source in [`demo-vault/`](./demo-vault/README.md) in this repository.

## What it does

- **The vault-root row** — the row at the very bottom of the left sidebar showing your vault's name —
  gets the full folder menu: **New note**, **New folder**, **New canvas**, **Set as attachment
  folder**, and the rest.
  [01 Root folder context menu](<./demo-vault/01 Root folder context menu.md>)
- **The empty area** below the last file in the `Files` pane opens that same menu, so you do not have
  to aim at the vault-name row.
  [02 Empty area context menu](<./demo-vault/02 Empty area context menu.md>)

Entries that make no sense for the vault itself — **Rename**, **Delete**, **Move folder to...**, **Make
a copy**, **Search in folder** — are removed. There is nothing to configure.

## Installation

The plugin is available in [the official Community Plugins repository](https://obsidian.md/plugins?id=root-folder-context-menu).

### Beta versions

To install the latest beta release of this plugin (regardless if it is available in [the official Community Plugins repository](https://obsidian.md/plugins) or not), follow these steps:

1. Ensure you have the [BRAT plugin](https://obsidian.md/plugins?id=obsidian42-brat) installed and enabled.
2. Click [Install via BRAT](https://intradeus.github.io/http-protocol-redirector?r=obsidian://brat?plugin=https://github.com/mnaoumov/obsidian-root-folder-context-menu).
3. An Obsidian pop-up window should appear. In the window, click the `Add plugin` button once and wait a few seconds for the plugin to install.

## Debugging

By default, debug messages for this plugin are hidden.

To show them, run the following command:

```js
window.DEBUG.enable('root-folder-context-menu');
```

For more details, refer to the [documentation](https://mnaoumov.dev/obsidian-dev-utils/guides/debugging/).

## Changelog

All notable changes to this project will be documented in the [CHANGELOG](./CHANGELOG.md).

## Contributing

Contributions are welcome — see [CONTRIBUTING](./CONTRIBUTING.md) to get set up.

## Support

<!-- markdownlint-disable MD033 -->

<a href="https://www.buymeacoffee.com/mnaoumov" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" width="217"></a>

<!-- markdownlint-enable MD033 -->

## My other Obsidian resources

[See my other Obsidian resources](https://github.com/mnaoumov/obsidian-resources).

## License

© [Michael Naumov](https://github.com/mnaoumov/)
