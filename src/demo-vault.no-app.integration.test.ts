import process from 'node:process';
import { registerDemoVaultCoverageSuite } from 'obsidian-dev-utils/script-utils/demo-vault-coverage';
import { getRootFolder } from 'obsidian-dev-utils/script-utils/root';

// Keeps the in-repo `demo-vault/` honest WITHOUT launching Obsidian. Root Folder Context Menu has no
// Settings and no public API interface — it adds the folder context menu to the vault root and the
// Empty area, and nothing else — so there is nothing to reflect from source and the suite is registered
// With `rootFolder` alone. What it still enforces is the authoring convention every vault owes its
// Readers: an `# H1` and a prose opener on every note, Markdown links rather than wikilinks (which do
// Not render on GitHub), no `[Docs]` line, and every note reachable from `00 Start.md`. The plugin's
// Runtime behavior is covered by the other tests.
registerDemoVaultCoverageSuite({ rootFolder: getRootFolder() ?? process.cwd() });
