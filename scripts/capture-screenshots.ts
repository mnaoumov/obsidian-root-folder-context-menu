import { wrapCliTask } from 'obsidian-dev-utils/script-utils/cli-utils';
import { test } from 'obsidian-dev-utils/script-utils/test-runners/vitest';

// Desktop only for now. The mobile hook works as of T506-P32 — a long press on
// The vault name at the top of the left drawer raises the full menu — so a
// Mobile set is owed and is tracked in T461-P21; there is simply no android
// Capture project here yet.
await wrapCliTask(async () => {
  await test({
    projects: ['capture-screenshots:desktop']
  });
});
