# ZIP Rendering and Archive Contract

## User workflow boundary

This document specifies ZIP generation, rendering, validation and safe file handling only. It does **not** define a standalone user-facing export action.

The user-facing operation is **Save JSON + ZIP**, which creates a same-basename JSON/ZIP pair from one immutable Article v6 snapshot. See [COMBINED_ARTICLE_SAVE.md](COMBINED_ARTICLE_SAVE.md) for folder selection, overwrite confirmation, paired commit, clear behavior and Card Library path updates.

## Archive format

- Root-level `article.json` contains the complete Article v6 document.
- Every rendered page is stored as `images/page-001.png`, `images/page-002.png`, etc.
- No single-page PNG or PNG-only user workflow is provided.
- `article.json` is UTF-8 without BOM, two-space indented, keeps Chinese readable and ends with a newline.
- Runtime styles, settings, pagination metadata and transient UI state are not part of Article JSON.

## Snapshot and validation

- The renderer receives an immutable Article v6 snapshot, render signature and page count.
- Validate `schemaVersion: 6`, the complete Article schema, signature, page count and page dimensions before rendering.
- Rendering uses the request snapshot, never mutable live editor state.
- Reject v5 and earlier schemas; no transitional v5 export path is supported.

## Rendering

- A dedicated WebView2 renderer loads the embedded local `render.html`.
- Rendering reuses the shared React pagination/render implementation.
- Nunito Sans Latin / Latin Extended (400/800) is bundled. Chinese glyphs use Windows fallback: Microsoft YaHei UI, Microsoft YaHei, DengXian, then sans-serif.
- Preview and archive rendering use the same font stack and rendering environment.
- Capture every page at the configured page dimensions.
- If a session-scoped companion image is part of the active Article rendering session, preview and ZIP rendering must consume the same already-loaded resource and crop; the export stage must not independently search for another image.

## Archive lifecycle and safety

- Stage a task-specific temporary ZIP in the destination directory.
- Before commit, reopen and validate the archive, Article v6 schema, expected entry count, every page entry, PNG signature and IHDR dimensions; read each PNG entry fully to detect decompression errors.
- Commit only after validation. Failure or cancellation cleans only the current task's temporary archive and preserves an existing destination.
- Paired JSON + ZIP saving stages and validates both outputs, backs up existing targets and commits the pair with best-effort rollback. Do not claim cross-file filesystem atomicity.
- The reusable WPF progress dialog reports status and requests cancellation through the task cancellation token.

## Regression checks

Cover invalid request envelopes, schema rejection (including v5), page-count/dimension bounds, renderer/font failures, signature mismatch, cancellation at each cancellable stage, write/validation/commit failures, preservation of existing targets, temporary-file cleanup and semantic equivalence of the JSON plus all expected PNG entries. Real Windows/WebView2 checks remain separate from browser tests.
