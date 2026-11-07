# EnglishCards Article v6 — phase 1 data foundation

Status: **implemented, independently tested, NOT YET CONNECTED TO THE PRODUCTION EDITOR**.

## Baseline

This phase is based on `EnglishCards-width-constrained-zoom-full(1).zip`, not the earlier `EnglishCards.zip`.

## Files

- `src/v6/article.ts`: canonical v6 types, strict schema validation, ID generation, paragraph parsing, vocabulary deduplication, list operations, TXT export.
- `src/v6/importers.ts`: two independent JSON / plaintext importers plus an import coordinator.
- `EnglishCards.Tests/frontend/unit/article.test.ts`: Article v6 tests registered with Vitest so the normal `npm test` command discovers and reports them.

## New v6 contract

The root object has **exactly** these required fields:

- `schemaVersion: 6`
- `id: string` (nonblank)
- `title: string` (required, may be empty)
- `identityTag: string` (required, may be empty)
- `content: { paragraphs: Paragraph[] }`
- `vocabulary: VocabularyItem[]`
- `translation: { paragraphs: Paragraph[] }`

Paragraphs have exactly `id` and `text`. IDs are `p001`–`p999`, sequential within each of `content` and `translation`. Each section independently permits at most 999 paragraphs. No blank paragraphs are persisted. Vocabulary IDs are sequential `v001`–`v999` with at most 999 entries. Vocabulary items retain `word`, optional `ipa`, `highlight`, and `senses` with fields `pos`, `meaning`, `example`, `exampleTranslation`; at least one sense is required (an empty-valued sense is allowed). `expressions`, `mainIdea`, `personalizedHeader`, `readingLevel`, `theme`, and `warnings` are not accepted.

Vocabulary deduplication compares NFC-normalized, whitespace-collapsed, case-insensitive (`en`) word text. No lemmatization or semantic merging is attempted. Removing an item renumbers IDs.

## Import contract

One import coordinator always attempts Article JSON first. JSON with a valid v6 schema is imported regardless of `.txt` / `.json` extension. On JSON parse/validation error:

- `.json` input: **reject**; never treat JSON as prose.
- `.txt` input that resembles JSON (`{` / `[` first significant character) or parses as JSON of any type: **reject**; never silently misread a malformed/legacy project as prose.
- Other `.txt` input: parse as plain text.
- Other extensions: reject.

TXT title comes from the basename minus its final extension. TXT content preserves natural paragraphs separated by one or more blank lines; a single line break inside a paragraph becomes a space. TXT import initializes `identityTag: ''`, empty vocabulary and translation. Empty TXT is rejected; input over 999 paragraphs is rejected without changing the existing Article.

TXT export writes only English article body text with a blank line between paragraphs.

## Tests

The Article v6 tests are registered with Vitest and are included in the normal test command:

```sh
npm test
```

The first Windows run exposed a test-runner mismatch: the Article v6 file used Node's `node:test` API and Vitest reported no suite. The file was converted to Vitest registration and renamed to `article.test.ts`. The subsequent owner-supplied Windows log confirms `npm test` passed all 46 tests across 10 suites, including all 11 Article v6 tests.

The same owner-supplied log reports Vite production build PASS, Playwright 61/61 PASS, and .NET win-x64 framework-dependent publish PASS. Those E2E tests still exercise the current v5 application and do not establish v6 application integration.

## Integration boundary (next phase)

**Do not mistake this foundation for an app-wide schema migration.** The current production app still uses the v5 model in `EnglishCards/frontend/src/models/project.ts`, `EnglishCards/frontend/src/services/projectIO.ts`, `EnglishCards/frontend/src/viewmodels/useEditorViewModel.ts`, `EnglishCards/frontend/src/views/EditorView.tsx`, `EnglishCards/frontend/src/services/pagination.ts`, and the desktop bridge/export handlers. No changes to those production entry points were made in this phase. Sample fixtures, the full editor tests, WPF schema gates and ZIP export still reflect v5; the Article generation Skill has been rewritten for the v6 target.

Before enabling v6 in the UI, migrate all read/write paths as one consistent set, adjust the test fixtures, eliminate v5 code paths, and update `README.md`, `AGENTS.md`, `docs/`, and `skills/`. The coordinated directory/build migration now places production code in `EnglishCards/`, tests in `EnglishCards.Tests/`, Skills in `skills/`, and the sole publish target in `dist/EnglishCards/`.

The final selection-plus-button behavior remains a future UI phase: selection only in left preview, within one natural paragraph and one card, contains at least one Latin letter and no Han ideograph, position square rounded `+` near lower-right of selection, no tooltip; entry `word` may be a phrase. No right-side selection-to-add interaction.


## Phase 2A — directory and build-path migration

The repository has been reorganized: WPF and React production code now live under `EnglishCards/`; .NET, Vitest and Playwright tests live under `EnglishCards.Tests/`; Skills are at the root `skills/`; development-only Express/Vite test server code lives under `tools/`; Vite output is `EnglishCards/.build/frontend-dist/`; test output is root `.build/`. The production application still uses the v5 model at this stage. Windows verification of the new paths remains required.
