import type { FileExplorerView } from '@obsidian-typings/obsidian-public-latest';

import { TFolder } from 'obsidian';
import { getPrototypeOf } from 'obsidian-dev-utils/object-utils';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';

export class FileExplorerViewOpenFileContextMenuPatchComponent extends MonkeyAroundComponent {
  public constructor(private readonly fileExplorerView: FileExplorerView) {
    super();
  }

  public override onload(): void {
    this.registerMethodPatch({
      methodName: 'openFileContextMenu',
      obj: getPrototypeOf(this.fileExplorerView),
      patchHandler: ({
        fallback,
        originalArgs: [, fileItemEl],
        originalThis
      }) => {
        if (!(fileItemEl.parentElement instanceof HTMLElement)) {
          return;
        }
        const file = originalThis.files.get(fileItemEl.parentElement);

        if (!(file instanceof TFolder) || !file.isRoot()) {
          fallback();
          return;
        }

        file.isRoot = (): boolean => false;
        fallback();
        file.isRoot = (): boolean => true;
      }
    });
  }
}
