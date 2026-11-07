> **历史记录：** 本文记录较早的实施阶段，可能包含旧目录、schemaVersion 5 或旧发布路径。当前有效目录、Article v6 契约和实施状态以 [`docs/project-contract.md`](project-contract.md) 与 [`docs/implementation-status.md`](implementation-status.md) 为准。

# EnglishCards Remediation Plan

This plan follows the supplied `windows-app-review` Skill. It avoids architecture rewrites and behavior changes without evidence and approval.

## Completed in this documentation pass

- [x] Add root `AGENTS.md`.
- [x] Vendor the supplied `windows-app-review` Skill and all adjacent references.
- [x] Consolidate `docs/project-contract.md` around confirmed current behavior.
- [x] Add focused EditorBridge and ZIP export contracts.
- [x] Record review findings and distinguish owner-reported acceptance from fresh verification.
- [x] Mark obsolete handoff/design/plan documents as historical without deleting them.

## Next: targeted reliability review

### P1 — Bridge exception and navigation lifecycle

Review `EditorBridge.Receive`, `RunFileCommandAsync`, `HandleFileCommandAsync`, and `desktopBridge.ts`.

- No unobserved task exception may escape the WebView event boundary.
- Every valid request receives one response unless its page is stale or disposed.
- Stale requests cannot alter the current page state.
- Add focused regression tests before changing behavior.

### P1 — ZIP cancellation and commit boundary

Review `ZipExportService`, `CardCapture`, and `ProgressDialog`.

- Cancellation must be checked before final commit.
- The existing target must not be removed before a validated staged archive is ready.
- A task may clean only its own temporary file.
- Verify renderer disposal/close ordering on success, failure and cancellation.
- Add regression coverage for existing-target preservation and commit failure.

### P1 — Persistence replacement policy

Review `UserDataStore.StageAndMoveAsync` and callers.

- Document overwrite ownership and conflict behavior.
- Confirm temporary files are on the same volume as the target.
- Cleanup must not mask the original exception.
- Verify rejected-source backup behavior when reading fails or the source changes during preservation.
- Keep old LocalAppData untouched.

### P1 — Runtime dependency UX

- Document .NET 10 Desktop Runtime x64 accurately.
- Verify WebView2 Evergreen missing-runtime and initialization failure guidance.
- Do not add a native launcher or custom .NET runtime downloader.
- Distinguish hostfxr startup failure (before WPF code runs) from WebView2 initialization failure (inside the app).

### P2 — Build and archive hygiene

- Verify `tools/publish.bat` safely handles stale publish output without deleting `userdata`.
- Prefer isolated staging output for clean publish validation.
- Produce source archives without `bin/`, `obj/`, `artifacts/dist/`, `dist/` or user data.
- Preserve test fixtures and assets pending redistribution-rights review.

### P2 — Historical documentation

- Check all inbound links before archiving old plans/reports.
- Keep current README, contract and actual commands consistent.
- Do not delete historical records solely to make the tree smaller.

## Release gate

Run on Windows against the exact final source:

```bat
npm.cmd ci
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
dotnet run --project desktop\EnglishCards.Tests\EnglishCards.Tests.csproj -c Release
dotnet publish desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\wpf
```

Then manually verify the published EXE on Windows x64 with .NET 10 Desktop Runtime and WebView2 Evergreen: first-run userdata creation, save/reopen, complete ZIP export, cancel/close cancellation, temporary cleanup, and preservation of an existing ZIP.

No Git commit, push or tag is part of this plan until separately authorized.

## Round 3 review update

- [x] Inspect actual `UserDataStore` staged-write and rejected-backup paths.
- [x] Add deterministic regression coverage for staging writer failures and creation of a new destination during staging.
- [ ] Run the C# test executable on Windows against this exact revision.
- [ ] If external tools editing an already-existing settings/draft file during a save must be supported, first agree on conflict policy (fail and request reload vs. last-writer-wins). No compatibility layer or automatic migration is planned.
- [ ] Continue with `ZipExportService` review after the Windows test run.


## Fifth-round WebView2/EditorBridge actions

- [x] Replace prefix origin checks with exact parsed HTTPS origin validation.
- [x] Correlate navigation completion with the requested NavigationId and final source.
- [x] Ensure WebView2 disposal failure cannot skip user-data lease disposal or base window close.
- [x] Add exact-origin regression tests.
- [ ] Verify startup cancellation while WebView2 is initializing on Windows.
- [ ] Verify WebView2 browser-process failure during editor use and export.
- [ ] Verify normal close and close after failed initialization.


## Round 6 — React / TypeScript

- [x] Review ViewModel, bridge persistence, history, pagination, preview/export data flow.
- [x] Prevent edits/history actions during an in-flight project open without disabling later Open requests.
- [x] Add E2E coverage for open cancellation, stale response, and failure restoring editing.
- [ ] Verify Vitest, Playwright and production build on Windows.


## Seventh-round Windows release review

- [x] Verify framework-dependent .NET 10 WPF single-file publishing contract and document the Desktop Runtime x64 prerequisite.
- [x] Verify WebView2 Evergreen remains an external machine prerequisite.
- [x] Add a user-facing WebView2 initialization failure message and official Microsoft recovery link.
- [x] Verify publish wrapper does not delete `userdata` and fails safely on a detected self-contained output.
- [x] Verify Git ignore coverage for generated artifacts and portable user data.
- [x] Verify end-user runtime does not require Node.js, npm, Express, Playwright or standalone Chromium.
- [ ] Run C# tests and build on Windows x64.
- [ ] Publish to `dist\wpf` and inspect actual files.
- [ ] Test on a clean Windows x64 machine with .NET Desktop Runtime absent/present and WebView2 Evergreen absent/present.
- [ ] Confirm republishing preserves an existing `dist\wpf\userdata`.


## Round 8 — Font payload reduction

- [x] Remove bundled Noto Sans SC dependency.
- [x] Limit Nunito Sans to Latin / Latin Extended subsets and 400 / 800 weights.
- [x] Use Windows CJK fallback stack consistently in editor and pagination.
- [x] Update font readiness regression and product/export documentation.
- [ ] Verify npm install, build, Vitest and Playwright on Windows.
- [ ] Verify Chinese line wrapping, page count, preview and PNG export on a Chinese Windows installation.


## Release candidate closure (latest status, 2026-11-06)

The owner's latest Windows log supersedes older unchecked items in the historical round sections above:

- [x] `npm.cmd ci` completed (184 packages).
- [x] Vitest 35/35.
- [x] Playwright 59/59.
- [x] TypeScript / Vite production build.
- [x] .NET desktop tests 16/16.
- [x] Framework-dependent win-x64 single-file publish.
- [x] Owner's visual comparison of Chinese preview versus exported PNG.
- [ ] Clean Windows x64 VM with missing/present prerequisite runtimes.
- [ ] Prove safe republish preserves actual `userdata/` bytes using disposable release folder.
- [ ] Review public redistribution rights for sample/reference assets.
- [ ] Choose version consistently (npm `1.0.0` vs earlier `v0.1.0`) and authorize any Git tag/release.

Authoritative remaining checks: [`RELEASE_ACCEPTANCE.md`](RELEASE_ACCEPTANCE.md).


## Round 9 — Responsive preview and zoom toolbar

- [x] Set both resizable pane minimums to 280 DIP.
- [x] Fit one preview card to the preview content height by default with 12 DIP top/bottom padding.
- [x] Keep cards horizontally centered and allow horizontal scrolling when wider than the preview.
- [x] Keep automatic fit tied to preview height only; width/splitter changes do not affect zoom.
- [x] Replace the former fit-height/toolbar behavior with width-constrained Ctrl + wheel zoom (20%–100%); permanently commit zoom reductions caused by a narrower preview pane.
- [x] Add the horizontal borderless 15 DIP floating zoom toolbar with hover and one-second fade behavior.
- [x] Add/update E2E coverage and project contract.
- [ ] Run `npm.cmd ci`, `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run test:e2e` on Windows.
- [ ] Run .NET tests and republish `dist\wpf` on Windows; visually verify multi-page preview, centering, scrolling and unchanged PNG/ZIP output.
