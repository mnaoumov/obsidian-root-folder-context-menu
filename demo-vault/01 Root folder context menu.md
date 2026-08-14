# Root folder context menu

In a stock Obsidian vault, right-clicking the **vault root** in the File Explorer (the row at the very bottom of the left sidebar that shows your vault's name) does nothing - there is no context menu. Every *other* folder has one, but the root is left out. This plugin fills that gap: it gives the vault root the same right-click menu any folder gets.

![The two spots with no context menu of their own: the empty area below the file list, and the vault-name row beneath it](<./_assets/images/context-menu-area.png>)

## Try it

1. Open the **File Explorer** (the left sidebar; toggle it with the folder icon or `Ctrl/Cmd+Shift+E`).
2. Find the row at the very bottom showing this vault's name - that is the vault root.
3. **Right-click** it.
4. A context menu appears with folder actions such as:
   - **New note**
     - creates a note at the vault root.
   - **New folder**
     - creates a folder at the vault root.
   - **New canvas**
     - creates a canvas at the vault root.
   - **Set as attachment folder**
     - points new attachments here.

Try **New note** or **New folder** - the new item lands at the top level, next to [Sample Folder](<./Sample Folder/Note in folder.md>) and the notes already here.

## What is left out on purpose

Some folder actions make no sense for the vault root, so the plugin hides them: **Rename**, **Delete**, **Move folder to...**, **Make a copy**, and **Search in folder** are all omitted - you cannot rename or delete the vault itself. Everything that *does* apply to a top-level location stays.

## Where else it works

The same menu is also available on the empty area below the file list - see [02 Empty area context menu](<./02 Empty area context menu.md>).
