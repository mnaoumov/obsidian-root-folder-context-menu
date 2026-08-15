# Empty area context menu

The vault root is not the only spot this plugin improves. The **empty area** of the `Files` pane - the blank space *below* the last file in the File Explorer - gets the same full root-folder menu, so you do not have to aim precisely at the vault-name row.

## Try it

This vault is small enough that the file list may not reach the bottom of the pane, leaving nothing to right-click. The button fills it out:

```code-button
---
caption: Create filler notes so the file list has some height
---
await require('/demoSetup.ts').fillFileList(app);
```

Manual equivalent: create any handful of notes until the file list fills the pane.

1. Open the **File Explorer**.
2. Scroll to the bottom of the file list so there is some empty space beneath the last item.
3. **Right-click the empty area** (not on any note or folder).
4. The same context menu from [01 Root folder context menu](<./01 Root folder context menu.md>) appears - **New note**, **New folder**, **New canvas**, and so on - all creating items at the vault root.

This is handy in a large vault: instead of scrolling back up to the vault-name row, right-click wherever there is blank space in the pane.

When you are done, put the vault back:

```code-button
---
caption: Delete the filler notes
---
await require('/demoSetup.ts').removeFillerNotes(app);
```

Manual equivalent: delete the `Materials/02 Empty area context menu` folder.
