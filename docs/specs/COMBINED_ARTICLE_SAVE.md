# Combined Article Save Workflow

Status: implementation in progress

This specification extends Phase E without changing the Article v6 schema.

## Product workflow

- The desktop toolbar keeps Settings and replaces New Card with Clear.
- The former Export ZIP action becomes Save (JSON + ZIP).
- Clear starts a new unsaved Article v6 editing session; it never deletes files.
- Save chooses a destination directory, writes a same-basename JSON and ZIP pair, then makes the destination the remembered Card Library root and opens the saved JSON.

## Clear contract

When there are no unsaved edits and no file operation in progress, Clear immediately resets the editor and preview to an empty Article v6 document, clears vocabulary selection and active file identity, and clears the selected card in the library.

When edits are pending, show Save / Discard / Cancel:
- Save performs the complete paired JSON+ZIP save; clear only after both files are committed successfully.
- Discard drops the unsaved editor revision without deleting or modifying the last committed files.
- Cancel leaves the editor and navigation unchanged.

A save already in flight must be settled before the session is discarded. A stale asynchronous write must never reactivate the previous article after Clear.

## Paired-save contract

- Choose a destination with the native Windows folder picker, initially at the last successfully loaded or saved Card Library root.
- Derive one safe basename from the English article title and use it for both `.json` and `.zip`.
- The JSON and ZIP must be generated from one immutable, validated Article v6 snapshot and one pagination signature.
- ZIP contains `article.json` and every page PNG, using the existing renderer and validation.
- If either target exists, ask once before replacing the pair.
- Stage both files in the destination directory, validate both, retain backups of existing targets, commit both, and roll back as far as possible if either commit fails. Do not claim true filesystem atomicity across two files.
- Update the remembered Card Library path, switch the left tree, refresh it, and activate the new JSON only after both files have committed.
- If path-preference persistence fails after the pair has committed, report that separately; do not roll back valid files or report the file save itself as failed.
- Cancellation or failure must not change the remembered root, current active article, or selected library root.

## State and concurrency

- Preserve the existing per-card JSON autosave coordinator and immutable snapshot discipline.
- Track paired-save completion separately from JSON autosave completion; JSON clean does not imply ZIP current.
- Serialize saves and associate them with a session identity and revision.
- Clear, card switching, and window close must not race a paired save.
- An in-flight write must not apply to a newer or cleared session.

## Removal

Remove the New Card dialog, create-card UI state, create-card bridge command, new-card-specific path preference, and obsolete tests. Preserve card browsing/opening, Article v6 validation, settings, pagination, preview rendering, and ZIP rendering/validation.

## Verification

Add frontend and .NET tests for:
- clean clear; Save / Discard / Cancel choices; save failure blocking clear;
- clearing while JSON autosave or paired save is in flight;
- empty Article v6 initialization and cleared active selection;
- same-snapshot JSON/ZIP generation and matching basenames;
- overwrite confirmation for either or both existing files;
- cancellation, write failure, rollback, and backup cleanup;
- remembered-root update only after successful pair commit;
- library-root switching, refresh, and reopening the saved JSON;
- restart persistence and stale-session protection.

Run frontend unit tests, TypeScript/Vite build, all Playwright E2E tests, .NET desktop tests, and Windows x64 publish before Windows acceptance.
