import { wrapCliTask } from 'obsidian-dev-utils/script-utils/cli-utils';
import { test } from 'obsidian-dev-utils/script-utils/test-runners/vitest';

// Desktop only: this plugin has no working mobile hook on current Obsidian
// Mobile, so there is no android capture project to run.
await wrapCliTask(async () => {
  await test({
    projects: ['capture-screenshots:desktop']
  });
});
