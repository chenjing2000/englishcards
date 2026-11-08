# Phase 2B-1 — Production Data Layer Status Correction

Date: 2026-11-07

## Important correction to the earlier migration audit

The earlier `PHASE2B1_PRODUCTION_MIGRATION_AUDIT.md` incorrectly described the supplied Phase 2B-0 baseline as still using the v5 production model. A direct inspection of the actual source archive shows that this was inaccurate.

The supplied baseline already has Article v6 wired through the principal production data path:

- `src/models/project.ts` re-exports Article v6 and aliases `Project` to `Article`.
- `src/services/projectIO.ts` uses `ArticleImportCoordinator`, validates Article v6 on open/save, and stores v6 drafts.
- `src/viewmodels/useEditorViewModel.ts` operates on `content`, `vocabulary`, and `translation`.
- `src/services/pagination.ts` renders `identityTag`, `content.paragraphs`, `vocabulary`, and `translation.paragraphs`.
- WPF `EditorBridge.SaveProjectAsync` checks schemaVersion 6.
- `ZipExportService` checks schemaVersion 6 and the archive JSON version.
- Existing unit tests explicitly test v6 import, v5 rejection, paragraph/vocabulary limits and draft preservation.

Therefore, a wholesale v5-to-v6 rewrite is not appropriate for this baseline. It would duplicate already completed work and create unnecessary regression risk.

## Remaining Phase 2B-1 gap identified

The browser-side parser performs strict Article v6 validation, but the WPF bridge previously checked only the `schemaVersion` value before saving. The ZIP export path also checked only the version before rendering and checked only the version again after reading the archived `article.json`.

This left a trust-boundary gap: a malformed v6 object could be sent directly to the desktop bridge or embedded in a ZIP request without the complete structural checks being repeated by the desktop process.

## Change in this patch

A new `ArticleContractValidator` now validates the complete Article v6 contract at the WPF boundary:

- exact top-level fields; no legacy or unknown fields;
- required strings and text limits;
- `content.paragraphs` and `translation.paragraphs` independently limited to 999;
- sequential `p001`–`p999` paragraph IDs;
- vocabulary limited to 999 with sequential `v001`–`v999` IDs;
- normalized duplicate vocabulary rejection;
- required `highlight` and `senses` arrays, with the existing v6 per-array limits;
- exact sense fields and string types;
- duplicate JSON property names rejected.

The validator is called before a standalone Article JSON file is saved, before ZIP generation begins, and when the generated ZIP's `article.json` is validated.

No v5 migration or compatibility adapter has been introduced.

## Remaining UI work is not part of this data-layer patch

The current editor still exposes separate 原文 / 词汇 / 译文 / 样式 tabs and existing selection-to-highlight controls. These are UI/product changes assigned to the later editor/preview phases. The underlying Article data model is already v6; the remaining UI must be migrated to the approved single editor page and selection-plus workflow without reintroducing old data fields.

## Validation limitation

This environment does not contain the .NET SDK and the npm dependency installation did not complete, so the modified C# project and full test suites could not be compiled or executed here. The new tests are added to the Windows .NET test harness and must be run on the user's Windows machine before this patch is considered verified.
