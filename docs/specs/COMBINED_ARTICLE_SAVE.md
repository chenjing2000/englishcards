# JSON + ZIP 联合保存与清空工作流

Status: **Implemented; Windows acceptance completed by the project owner (2026-11-11).**

This specification defines the user workflow that extends the Phase E Card Library. It does not change Article v6.

## Toolbar

The workspace toolbar provides:
- Clear current article
- Save JSON + ZIP

The former New Card and standalone Export ZIP actions are not part of the current workflow.

## Clear current article

- When the current article is nonempty, Clear shows a confirmation even if the article has no unpaired changes. An already empty editor may be reset directly if no save is in progress.
- The confirmation offers three choices:
  - **Save**: run the complete paired JSON + ZIP save. Clear only after both files have committed successfully.
  - **Discard**: discard the current unsaved revision without deleting or modifying the last committed files.
  - **Cancel**: preserve the current article, editor, preview and navigation state.
- If a save task is already in progress, do not clear or discard the session. Require that the task finish first.
- Stale asynchronous work from the previous session must never reactivate the previous article after Clear.

## Paired JSON + ZIP save

1. The user invokes Save JSON + ZIP.
2. Show the native Windows folder picker. Its initial directory is the most recently recorded successful Card Library path.
3. Derive a safe basename from the article title and create same-basename `.json` and `.zip` targets in the selected directory.
4. Generate both outputs from one immutable, validated Article v6 snapshot and the same pagination/render signature.
5. The JSON is the complete Article v6 document. The ZIP contains root `article.json` plus all rendered page images at `images/page-001.png`, etc.
6. If either target already exists, show one frontend overwrite confirmation. Reuse `phase-e-modal` and `phase-e-modal-heading`; do not use native WPF MessageBox.
7. Confirm replaces the pair. Cancel, close, or backdrop click cancels without changing either existing target. ESC is not a cancellation gesture; this is an accepted behavior.
8. Stage and validate both files before commit. Keep backups of existing targets and roll back as far as possible if either commit fails. Do not claim true filesystem atomicity across two independent files.
9. Only after both files commit successfully, update the remembered path, switch the Card Library root to the destination, refresh it and activate the saved JSON.
10. If preference persistence fails after file commit, report that separately; do not misreport the committed file pair as failed.

Cancellation or failure must not change the remembered path, active article or selected library root.

## State, serialization and concurrency

- Preserve the per-card JSON autosave coordinator and immutable snapshot discipline.
- Track paired-save completion separately from JSON autosave completion; JSON being clean does not imply that the paired ZIP is current. The Save-button star reflects document/page-style changes relative to the current session's paired-save baseline; it persists after JSON autosave and disappears after successful paired save. A newly opened document begins without a star, but this does not verify an existing ZIP.
- Editing, autosave, settings, native folder selection, overwrite confirmation and paired save must not clear the last valid preview. New pagination replaces it when ready; saving cannot use a stale layout and preview selection is blocked while stale.
- Serialize writes and associate each operation with a session identity and revision.
- Clear, card switching and window close must not race a paired save.
- An in-flight write must not apply to a newer or cleared session.
- Card switching during ordinary JSON save remains blocked. Blocked clicks are discarded; there is no queued or remembered destination card.

## Verification

The implemented workflow was included in the post-Phase-E Windows acceptance. Regression coverage should continue to cover clean/dirty clear, Save/Discard/Cancel, in-flight operations, same-snapshot outputs, matching basenames, overwrite when either or both targets exist, cancellation, write failure, rollback, preference update timing, library-root switching and stale-session protection.
