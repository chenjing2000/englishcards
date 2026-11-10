# Phase E — Card Library and File-backed Article Workflow

Status: **Approved product decisions; implementation in progress**
Base: `main` at `dba7fd5861020570dd97496e195f1d202d69b2f4` (2026-11-10)
Branch: `feature/phase-e-card-library`

This specification supersedes conflicting older import, draft, toolbar and workspace instructions in `README.md`, `docs/project-contract.md` and `docs/specs/PHASE2B_PRODUCT_ADDITIONS.md`. Existing Article v6 constraints and validated editor/preview behavior remain in force.

## 1. Product scope

- Article remains strictly `schemaVersion: 6`. Each card is an independent JSON file.
- Card Library browses a user-selected root directory as a directory tree. Load children lazily. Open JSON files directly from the tree.
- File paths belong to the file system, not to a separate card database. No cross-directory coordination, indexing database or recursive background watcher.
- Remove JSON/TXT import UI and manual standalone JSON save/export UI. Do not introduce automatic folder management or migration.
- The sole official user export is complete ZIP with `article.json` and all page PNG images. Retain existing ZIP overwrite, cancellation, temporary-file cleanup and existing safety checks; add no expiry check or redundant post-export verification.
- No migration, backward compatibility, or recovery framework for old global drafts. Do not automatically delete the user's existing draft files. Settings persistence remains independent.
- Userdata remains adjacent to the executable, unchanged.

## 2. Save and navigation contract

- Debounce ordinary edits by about 300 ms and automatically save a validated Article v6 snapshot to the active card's JSON path.
- Bind every write to the captured target path and immutable snapshot; serialize writes for the active card and track revisions. Only acknowledge the revision actually written.
- `clean`: switching JSON cards is allowed immediately.
- `dirty` (edit exists; debounce not elapsed): a click on another card **does not switch**; trigger saving the current card promptly and notify the user to click again once the save completes.
- `saving`: a click on another card **does not switch**; notify the user to click again once the save completes.
- `error`: do not switch or discard in-memory edits; show persistent error and allow retry.
- **No pending switch queue, target-card memory, or automatic switching.** Every blocked click is discarded.
- The same unsaved-write gate applies to creating a new card, export and application close. The latter two may wait for an in-flight write internally, but may not silently discard edits.
- If the user edits again while an earlier revision is saving, save the newer revision before declaring clean.
- Keep short-lived unfinished input buffers in memory; never weaken the persisted Article v6 schema just to save an incomplete edit.
- New files must use non-overwriting creation. Only activate a new card after file creation succeeds.
- Directory expansion, collapse and scrolling remain usable during saves.

## 3. Workspace

- Three columns: library initially 310 DIP; remaining workspace preview/editor = 55:45; preserve splitter interaction, zoom and horizontal preview centering.
- Enforce sensible minimum workspace width; do not let a narrow window make editors inaccessible.
- Upper toolbar order: Settings, New Card, Export ZIP. Preserve approved 40 DIP round / 20 DIP SVG visual tokens where applicable.
- Settings is an in-workspace modal surface; preserve existing valid settings fields and default reset, remove import-settings UI.
- Notifications appear centered at the bottom of the preview pane: default 300 DIP, min 240, max 360; normal messages fade over 5 seconds; errors persist until dismissed; all messages have close buttons; multiple notices stack upwards and reflow down as earlier notices disappear.

## Phase E final UI adjustments (2026-11-10)

- Floating notices remain anchored to the preview pane's lower center but render in a body-level overlay above modal backdrops, so create-file errors are visible while the New Card dialog remains open.
- Normal, warning, and error notices all have default width **360 DIP**, minimum **240 DIP**, and maximum **480 DIP**, further constrained by available preview width. Multiple notices continue to stack upwards. Normal notices expire after five seconds of active display, pause on hover, and are individually dismissible. Errors persist until dismissed or resolved.
- Design Settings modal is centered with **320 DIP** default width, **280 DIP** minimum, and **360 DIP** maximum. Reduce its horizontal content padding and use a 60/40 two-column settings table to avoid unnecessary wrapping; internal scrolling remains available.
- New Card modal does not show an inline duplicate-file or filesystem-error label. Business errors are reported once through the shared notice service. Card-library directory chooser and lazy-directory read failures also use this same floating notice service instead of inline error labels. Failed creation leaves the dialog open with the original title and does not overwrite a JSON file. A successful subsequent creation closes the dialog, clears the resolved create error, and emits a normal success notice.
- Dismissing a save-error notice must **not** clear the underlying failed-save status or unlock a protected card switch.

## 4. Implementation sequence and gates

0. Freeze requirements, inspect baseline and establish regression coverage.
A1. Implement file identity, revision-aware save coordinator and navigation lock, with isolated unit tests.
A2. Replace draft-primary persistence with file-backed JSON auto-save and WPF bridge, preserving atomic writes and strict validation.
B. Add lazy directory tree, file opening, and non-overwriting New Card creation; remove old import/save UI.
C1. Three-column layout and minimum-width/resize behavior.
C2. Three-button SVG toolbar and in-workspace modal settings.
C3. Stacked notifications and expiry/persistence rules.
D. Integrate ZIP export and close flows, regression tests, owner Windows acceptance, and update current docs.

Each phase must pass relevant unit/E2E/.NET tests and, where applicable, real Windows/WPF/WebView2 acceptance. Do not claim local Windows validation when unavailable.

## 5. Explicit non-goals

No database, autosync, automatic file renames/deletions, FileSystemWatcher, alternative document schema, undo/redo, complex compatibility logic, or new export format.
