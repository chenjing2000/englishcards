# Complete ZIP Export Contract

## User-visible behavior

- The only official export action is **Export all ZIP**.
- The archive contains root-level `article.json` and every page image under `images/page-001.png`, `images/page-002.png`, etc.
- There is no single-page PNG or PNG-only user workflow.
- `article.json` is UTF-8 without BOM, two-space indented, keeps Chinese readable, preserves schemaVersion 5 data, and ends with a newline.

## Snapshot

The editor sends an immutable export request containing `project`, `document`, `signature`, and `pages`. The service validates the request, schema version, signature, page count, and page dimensions before rendering. Rendering must use this request snapshot, not mutable live editor state.

## Rendering and archive lifecycle

- A dedicated WebView2 renderer loads the embedded local `render.html`.
- Rendering uses the shared React pagination/render implementation. Nunito Sans Latin / Latin Extended (400/800) is bundled; Chinese glyphs use the target Windows system fallback stack: Microsoft YaHei UI, Microsoft YaHei, DengXian, then sans-serif. Preview and export run in the same WebView2 environment and use the same font stack.
- Every page is captured at the configured page dimensions.
- A task-specific temporary ZIP is staged in the destination directory.
- Before commit, reopen and validate the archive, article schema version, expected entry count, every page entry, each PNG signature and IHDR dimensions, and read each PNG entry fully to detect ZIP payload/decompression errors.
- Commit only after validation. Failure/cancellation must clean only the current task's temporary archive and preserve an existing destination.
- The reusable WPF `ProgressDialog` reports status and requests cancellation through the export cancellation token.

## Required regression checks

Cover invalid request envelopes, schema rejection, page count/dimension bounds, renderer/font failures, signature mismatch, cancellation during each cancellable stage, write/validation/commit failures, existing-target preservation, temporary-file cleanup, and successful semantic equivalence of the JSON plus all expected PNG entries. Real Windows/WebView2 checks are separate from unit tests.
