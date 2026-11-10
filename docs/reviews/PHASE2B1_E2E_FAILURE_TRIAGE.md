# Phase 2B1 — E2E failure triage and test corrections

Date: 2026-11-08

## Scope

This pass addresses the seven Playwright failures reported from the Windows run. It does not change production behavior. The planned single-page editor consolidation remains a separate implementation phase.

## Findings and corrections

1. `compact-editors.spec.ts`
   - The current compact Vocabulary editor intentionally displays the part-of-speech prefix together with the meaning in one editable field.
   - Updated the expected value to include the fixture's POS prefix. The underlying Article `pos` and `meaning` fields remain separate.

2. `editor.spec.ts` — Translation paragraph action
   - The existing editor still exposes the paragraph-add action. Removing it belongs to the approved single-page/continuous-editor refactor, which has not yet been implemented.
   - Changed this test to assert the current behavior instead of asserting a future UI state prematurely.

3. `editor.spec.ts` — initial vocabulary headword
   - The sample Article is the Brainco fixture; its first word is `neuro-tech`, not the literal `word`.
   - Changed the assertion to use the fixture's first headword.

4. `entry-highlights.spec.ts`
   - The UI action inserts a blank entry below the currently selected entry; it does not promise that the inserted row is the final array element.
   - Changed the assertion to locate the blank-word entry and verify its `highlight` array is empty.

5. `senses-navigation.spec.ts`
   - This was a test-selector defect, not evidence of lost sense data.
   - `senseSourceId` uses a short `v002:meaning` ID for the first sense but JSON-encoded compound IDs for later senses. The old CSS selector `[data-edit$=":meaning"]` only matched the first-sense form.
   - Changed the selector to match the semantic field name (`[data-edit*="meaning"]`), allowing all five meanings to be observed. No pagination or data-model change was made.

6. `settings.spec.ts`
   - The renderer marks Vocabulary text spans with `data-edit` attributes and inline typography; it does not emit the obsolete `.vocab-meaning` and `.vocab-example` classes.
   - Updated the selectors to target the semantic `data-edit` field names.

7. `workspace.spec.ts` — 100% zoom
   - At the default 55:45 split, the preview pane may not have enough width to display a 1200-DIP card at 100%.
   - The test now moves the splitter to its maximum preview width before asserting the 100% zoom ceiling. The product's width constraint remains unchanged.

## Production source changes

None. The seven reported failures were caused by stale assumptions or selectors in the E2E tests. The `senses-navigation` failure was investigated against `senseSourceId`, pagination run construction, and DOM `data-edit` generation; the current implementation uses distinct compound IDs for later senses, and the test selector had excluded them.

## Verification status

The owner-provided Windows run reported:
- .NET tests: 17 passed.
- Vitest: 48 passed.
- TypeScript/Vite build: passed.
- Playwright: 51 passed, 7 failed.

After the test corrections in this pass, a fresh Playwright run could not be performed in this environment because `npm ci` did not complete and the local `vitest` executable was unavailable. Therefore these corrections are source-reviewed but **not yet runtime-verified**. Re-run the full Windows command:

```powershell
npm.cmd run test:e2e
```

Then run the complete verification sequence before proceeding to the single-page editor refactor.

## Deferred product work

The current editor still has separate `原文`、`词汇`、`译文`、`样式` pages and separate paragraph controls. This is known and intentionally not changed in this test-triage pass. The approved future editor consolidation remains:
- one continuous editor page;
- Vocabulary → Content → Translation order;
- a single continuous multi-paragraph editor for Content and Translation;
- title input above Content;
- no word-selection/add-to-vocabulary interaction in the right editor.


## Follow-up after Windows verification (2026-11-08)

The owner reran the complete suite after the first triage package:
- Vite build: passed.
- Vitest: 48/48 passed.
- Playwright: 56/58 passed.
- .NET: 17/17 passed.

The two remaining E2E failures were then traced to test synchronization/locator assumptions:

8. `editor.spec.ts` — strict import error notification
   - The test attempted to read `getByRole('alert')` before the first invalid import, when no alert exists yet.
   - Updated the test to clear any prior error notice before each invalid import, then wait for a newly visible alert and assert the rejection message and preservation of the current Article.

9. `senses-navigation.spec.ts` — example field click
   - Both the visible `例句：` label and the actual example text carry the same `data-edit` identifier, so the locator matched two elements.
   - Updated the test to click the exact example sentence text (`A distinct example.`), which exercises the intended preview-to-editor navigation target.

No production source was changed.

The two corrections are source-reviewed. They have not yet been executed in Playwright; the owner must rerun `npm.cmd run test:e2e` on Windows to verify the final 58/58 result.
