import process from 'node:process';
import { registerDemoVaultCoverageSuite } from 'obsidian-dev-utils/script-utils/demo-vault-coverage';
import { getRootFolder } from 'obsidian-dev-utils/script-utils/root';

// Keeps the in-repo `demo-vault/` honest WITHOUT launching Obsidian. Root Folder Context Menu has no
// settings and no public API interface — it adds the folder context menu to the vault root and the
// empty area, and nothing else — so there is nothing to reflect from source and the suite is registered
// with `rootFolder` alone. What it still enforces is the authoring convention every vault owes its
// readers: an `# H1` and a prose opener on every note, Markdown links rather than wikilinks (which do
// not render on GitHub), no `[Docs]` line, and every note reachable from `00 Start.md`. The plugin's
// runtime behavior is covered by the other tests.
registerDemoVaultCoverageSuite({ rootFolder: getRootFolder() ?? process.cwd() });
