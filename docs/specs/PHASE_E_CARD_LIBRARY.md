# Phase E — Card Library and File-backed Article Workflow

Status: **Complete; Windows/WPF acceptance passed and merged into `main`.**  
Phase E merge: PR [#2](https://github.com/chenjing2000/englishcards/pull/2), merge commit `8e47296dfa484f4f807550578ce9f3b147ad466e`.  
The subsequent paired-save and clear workflow was completed in commit `822864ff99787395b21b040a0b0fccc0c62e2fc6`.

## Verification

Phase E baseline: Vitest 64/64, Playwright 69/69, .NET desktop tests 19/19, TypeScript/Vite production build, Article v6 Skill validation, Windows x64 publish, real WPF/WebView2 startup and key UI acceptance, and GitHub Windows CI passed.

The later paired JSON + ZIP save and clear workflow was also accepted by the project owner on Windows. Do not attribute the Phase E baseline test counts to that later change as separate test counts.

## 1. Card Library

- Article remains strictly `schemaVersion: 6`; each card is an independent JSON file.
- The library browses a user-selected root directory as a directory tree and loads children lazily.
- Clicking a JSON file opens that Article. Filesystem paths are the identity; there is no card database, cross-directory index or recursive background watcher.
- The desktop UI has no legacy JSON/TXT import buttons and no standalone manual JSON save/export action.
- Do not restore old global-draft auto-recovery or migration. Do not automatically delete old draft files.
- User data remains adjacent to the executable in `userdata/`.

## 2. JSON autosave and card switching

- Ordinary edits are debounced (approximately 300 ms) and saved as a validated Article v6 snapshot to the active card JSON path.
- Bind each write to its captured target path and immutable snapshot; serialize writes and track revisions. Acknowledge only the revision actually written.
- While an edit is dirty or a save is in progress, clicking another card does not switch. Trigger/continue the save as appropriate and notify the user to click again after completion.
- Blocked clicks are discarded. There is no pending switch queue, remembered target card or automatic switching.
- On save error, retain in-memory edits and error state; do not switch or discard edits.
- If a new edit occurs while an earlier revision saves, save the newer revision before declaring the card clean.
- Keep incomplete input buffers in memory; do not weaken persisted Article v6 validation to persist unfinished input.
- Directory expansion, collapse and scrolling remain usable during saves.

## 3. Clear and paired save

The final toolbar and file workflow are defined by [COMBINED_ARTICLE_SAVE.md](COMBINED_ARTICLE_SAVE.md).

- Toolbar actions are Clear current article and Save JSON + ZIP (plus Settings); there is no New Card action or standalone Export ZIP action.
- Clear with unsaved edits offers Save / Discard / Cancel. Save clears only after both JSON and ZIP commit; Discard does not delete committed files; Cancel leaves the session untouched.
- An unfinished save operation blocks clearing until it completes.
- Save creates same-basename JSON and ZIP from one validated snapshot. If either target exists, use the shared frontend overwrite modal.
- On success, update the remembered Card Library path and switch the tree to the destination. On cancellation/failure, preserve current path and session.

## 4. Workspace and notices

- Three columns: Card Library initially 310 DIP; remaining preview/editor workspace defaults to 55:45. Preserve splitter interaction and minimum usable pane widths.
- Settings is an in-workspace modal surface. Preserve valid settings fields and reset behavior.
- Floating notices are centered at the bottom of the preview pane and stack upwards. Normal/warning/error notices use 360 DIP default width, 240 DIP minimum and 480 DIP maximum, constrained by available width. Normal notices expire after five seconds of active display, pause on hover and are individually dismissible; errors persist until dismissed or resolved.
- Dismissing a save-error notice must not clear the underlying failed-save state or unlock protected card switching.

## 5. Article v6 and editor

- Article v6 is the sole accepted schema. Each of Content and Translation permits at most 999 paragraphs; Vocabulary permits at most 999 entries.
- Vocabulary unifies words, phrases and idioms under `word`.
- The editor order is Vocabulary → Content → Translation. Content and Translation each use a continuous multi-paragraph editor.
- Selection-to-Vocabulary is available from the left preview only. Selection must remain within one card and one natural paragraph, contain at least one Latin letter and no Chinese character; duplicates are not added or overwritten.
- Preview and export use the same Article snapshot and shared pagination/rendering implementation.

## 6. Explicit non-goals

No database, autosync, automatic file renames/deletions, FileSystemWatcher, alternate document schema, undo/redo, global-draft recovery framework, or new export format.
