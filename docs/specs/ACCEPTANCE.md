# Article v6 与桌面工作流验收标准

Status: **Current acceptance reference.** Historical migration gates are superseded by the completed Article v6, Phase E and paired-save implementation. Recorded results are maintained in [RELEASE_ACCEPTANCE.md](../RELEASE_ACCEPTANCE.md).

## A. Article v6 data contract

1. The only accepted schema is Article `schemaVersion: 6`; reject v5 and earlier without migration or dual-write.
2. The root object contains only `schemaVersion`, `id`, `title`, `identityTag`, `content`, `vocabulary`, and `translation`.
3. `title` and `identityTag` are required strings and may be empty; reject unknown fields, missing fields and wrong types.
4. Content and Translation each use sequential `p001`–`p999` IDs and allow at most 999 paragraphs independently.
5. Vocabulary uses sequential `v001`–`v999` IDs and allows at most 999 entries.
6. Vocabulary uses `word` for single words, phrases and idioms; do not introduce a separate expressions collection.
7. Reject malformed JSON, unsupported schema versions, noncanonical IDs, duplicate IDs and capacity overflow. Never truncate content or silently reinterpret invalid JSON as plaintext.

## B. Card Library and editor

8. The Card Library browses a selected directory tree and opens independent JSON files.
9. Directory children are loaded lazily; the filesystem is the source of card identity.
10. The editor order is Vocabulary → Content → Translation. Content and Translation each use a continuous multi-paragraph editing surface.
11. Preview selection-to-Vocabulary is limited to one card and one natural paragraph, contains at least one Latin letter and no Chinese character, and adds entries through the `word` field.
12. There is no current user-facing JSON/TXT import button, New Card action, standalone JSON save action or legacy global-draft auto-recovery workflow.
13. While a card is dirty or saving, a request to switch cards is rejected and discarded; no pending target is queued. A save error preserves in-memory edits and blocks switching.

## C. Clear current article

14. With no unsaved edits and no save operation in progress, Clear resets the editor and preview and clears the active file/card selection.
15. With unsaved edits, Clear offers Save / Discard / Cancel.
16. Save completes the paired JSON + ZIP operation before clearing; a failed or cancelled save must not clear the article.
17. Discard drops only the unsaved in-memory revision and does not delete committed files.
18. Cancel preserves the current article, preview and navigation state.
19. An in-flight save blocks Clear until it has completed; stale asynchronous work must not reactivate the previous article.

## D. Paired JSON + ZIP save

20. Save opens a native folder picker, initially at the most recently remembered successful Card Library path.
21. Generate same-basename JSON and ZIP from one immutable, validated Article v6 snapshot and one pagination/render signature.
22. If either destination exists, show one frontend overwrite confirmation using the shared Phase E modal styles; do not use native WPF MessageBox.
23. Confirm commits the pair. Cancel, close and backdrop click cancel without changing existing files. ESC is not a cancellation gesture.
24. Stage and validate both outputs, preserve backups of existing targets and perform best-effort rollback on failure. Do not claim cross-file filesystem atomicity.
25. Only after both files commit successfully, remember the destination and switch/refresh the Card Library root there.
26. Cancellation or failure must not change the remembered root, active article or selected library root.

## E. ZIP rendering and archive

27. ZIP contains root `article.json` and every page image under `images/page-NNN.png`.
28. Article JSON is UTF-8 without BOM, two-space indented, Chinese-readable and ends with a newline. Runtime styles/settings are excluded.
29. Preview and ZIP rendering use the same Article snapshot, pagination/render implementation and font fallback.
30. Validate schema, render signature, page count/dimensions, archive entries, PNG signatures and IHDR dimensions before commit.
31. Cancellation/failure removes only the current task's temporary files and preserves existing destination content.

## F. Desktop runtime and release

32. Target is Windows x64, WPF + .NET 10 + WebView2 + React/TypeScript.
33. Publish is Framework-dependent, win-x64, single-file; target machine requires .NET 10 Desktop Runtime x64 and WebView2 Evergreen.
34. User data lives in EXE-sibling `userdata/`; publishing must not delete it. Do not read or migrate old `%LOCALAPPDATA%\\EnglishCards` data.
35. Browser tests do not replace real Windows/WPF/WebView2 startup and paired-save acceptance.
36. External clean-machine runtime, portability, upgrade-preservation and sample-asset rights checks remain separate release gates; see [RELEASE_ACCEPTANCE.md](../RELEASE_ACCEPTANCE.md).
