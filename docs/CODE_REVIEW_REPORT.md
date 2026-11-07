# EnglishCards Code Review — 2026-11-06

## Scope and evidence

- Review basis: supplied `windows-app-review` Skill and its reference documents.
- Source baseline: user-uploaded `EnglishCards.zip` (49,082,045 bytes).
- Owner-reported Windows acceptance: prior test and manual results in this conversation.
- The ZIP contains no `.git` metadata. Branch, commit, remotes and dirty working-tree state cannot be verified.
- This pass changes documentation and review instructions only; no C# or TypeScript runtime code was changed.
- No Windows/.NET build or runtime tests were executed in this environment.

## Summary

No Critical defect is confirmed from the static review. Important documentation conflicts were corrected. Several reliability topics require a focused follow-up review against the exact current Windows working tree.

## Findings and actions

### Important — Project contract contained contradictory states

`docs/project-contract.md` simultaneously described ZIP export as not implemented/not verified and as implemented/accepted. It also referenced a non-existent `tools\publish-desktop.bat` while the tree contains `tools/publish.bat`. These contradictions could cause regressions and incorrect commands.

**Action:** Consolidated the contract and separated current behavior from historical owner-reported evidence.

### Important — No root AGENTS.md

The archive had no root `AGENTS.md`, so coding agents had no mandatory entry to the project contract, review Skill, verification commands and protected behavior.

**Action:** Added root `AGENTS.md`.

### Important — Historical documents could be mistaken for current requirements

`docs/HANDOFF.md`, `docs/IMPLEMENTATION_PLAN.md` and `docs/specs/DESKTOP_WEBVIEW2.md` retain early single-page export, web prototype and LocalAppData descriptions.

**Action:** Added historical banners and pointed readers to the current contract. Files were not deleted.

### Important — Bridge behavior was undocumented

`desktop/Web/EditorBridge.cs` and `src/services/desktopBridge.ts` define a cross-language command contract, but there was no focused reference describing envelope, allow-list, source origin, ordering and stale-navigation behavior.

**Action:** Added `docs/specs/EDITOR_BRIDGE_CONTRACT.md` based on the inspected implementation.

### Important — ZIP export behavior lacked one authoritative focused spec

`ZipExportService`, `CardCapture`, `ArticleJsonFormatter` and `ProgressDialog` collectively define the user-visible export contract. Older docs still described prototype behavior.

**Action:** Added `docs/specs/EXPORT_CONTRACT.md`.

## Reliability follow-up targets (not confirmed defects)

1. `EditorBridge.Receive` is an `async void` WebView event handler. Confirm all exceptions from `RunFileCommandAsync` are observed and valid requests receive one response unless navigation is stale/disposed.
2. `UserDataStore.StageAndMoveAsync` determines `overwrite` before staging. Confirm the intended concurrent-writer policy and Windows replacement semantics.
3. Review `ZipExportService` around cancellation during archive finalization, renderer disposal/close order, final `File.Move(..., overwrite: true)`, and preservation of existing targets on every failure path.
4. `LocalWebContent` applies a prefix check to navigation/resource URLs. Confirm exact-origin behavior for unusual URL forms.
5. `App.OnStartup` is an async WPF override. Confirm exceptions always result in deterministic shutdown and no orphaned window.
6. WebView2 Evergreen missing-runtime/init-failure guidance is not demonstrated by this archive's visible startup path; verify actual Windows behavior.
7. The uploaded source archive includes `desktop/bin/`, `desktop/obj/`, and `artifacts/dist/`. `.gitignore` excludes generated output from Git, but the uploaded ZIP itself is not source-clean.
8. `tools/publish.bat` checks for `coreclr.dll` but does not prove that all stale self-contained files are absent. Validate clean staging without deleting `userdata`.

## Dependency review

`express` and `@types/express` are already in `devDependencies`; no dependency move is required. React, React DOM, Zod, fflate and font packages are build/runtime front-end dependencies embedded as static assets. Vite, TypeScript, Vitest, Playwright and tsx are development tooling.

## Verification performed

- Read the supplied Skill and all supplied reference documents.
- Inspected project contract, README, package manifest, WPF project, publish script, `.gitignore`, bridge, local WebView2 host, persistence, ZIP export, JSON formatter, progress dialog, project schema, Vite and Playwright configuration.
- Confirmed the source archive contains no `.git` metadata.
- No tests/builds were run in this environment.

## Historical owner-reported evidence (not rerun)

The owner previously reported 35/35 Vitest, 58/58 Playwright E2E, 9/9 .NET checks, successful Windows x64 publish, and manual acceptance of ZIP content, Pretty JSON, Win11 progress dialog, cancellation, temp cleanup and existing ZIP preservation. These are historical owner-reported results, not fresh verification of this review package.

## Conclusion

Keep WPF + WebView2 + React and the existing lightweight structure. No broad refactor is justified. The immediate work is contract/agent documentation normalization, followed by targeted bridge, persistence, export and runtime-UX reliability review.

## Round 3 — UserDataStore persistence review (2026-11-06)

**Scope:** `desktop/Persistence/UserDataStore.cs`, its `EditorBridge` callers, `src/services/projectIO.ts`, and the C# desktop test executable.

**Verified from source (not an execution result):**

- The application saves settings and drafts under the executable-relative `userdata/settings/` and `userdata/drafts/` directories. It does not depend on legacy LocalAppData data.
- Each staged file is created with `FileMode.CreateNew` and a random name in the destination directory. The writer is disposed before `File.Move`, and the owned staging file is removed in a `finally` block after a failure.
- For a destination that **did not exist at staging start**, `overwrite` is false. A different writer creating the destination before commit should cause the save to fail without replacing that new file. Added a deterministic regression test covering this boundary.
- For a destination that **already existed at staging start**, `File.Move(... overwrite: true)` commits unconditionally. The store does **not** detect an out-of-process edit made while the staged write is in progress. This is a **documented concurrency limitation**, not yet an approved behavior change; existing calls are serialised by `EditorBridge`, but external programs are not.
- Both `preserveOriginal` paths copy a readable rejected source into an independently named backup before attempting to commit replacement. The copy keeps the input stream open while staging. A missing original is handled separately from an unreadable original.
- Exception handling in the staging cleanup explicitly ignores cleanup I/O errors so as not to hide the primary save failure; if cleanup itself fails, a task-owned temporary file could remain. This is an unavoidable possible I/O failure and warrants an operational cleanup policy only if evidenced in practice.

**Changes in Round 3:** Added two regression cases to `desktop/EnglishCards.Tests/Program.cs` for a writer exception during staging and a new destination created by a competing writer before commit. No production C# or TypeScript code changed.

**Review outcome:** No confirmed production defect requiring a change to `UserDataStore` was found from the reachable scenarios inspected. Avoid changing external-overwrite policy without explicitly specifying expected ownership/conflict behavior. Do not describe the file move as durable across power loss (no explicit file/directory flush-to-disk guarantee was verified).

**Verification:** Source inspected; ZIP integrity verified. Windows/.NET tests **not executed in this environment**. Owner should rerun the desktop checks before merge/release.


## Round 4 — ZIP export lifecycle review (2026-11-06)

**Scope:** `desktop/Export/ZipExportService.cs`, `CardCapture.cs`, `ProgressDialog.xaml(.cs)`, `LocalWebContent.LoadAsync`, `EditorBridge` export caller, and `docs/specs/EXPORT_CONTRACT.md`.

### Confirmed findings

1. **Important — archive validation did not inspect PNG payloads.** The pre-commit check previously verified entry count, entry names, and `Length >= 24`, but never opened any PNG entry. A ZIP entry with a valid directory record but damaged/truncated compressed payload could pass the metadata-only check. The check also did not validate PNG signature, IHDR dimensions, or force a full read of each entry.
   - **Change:** Extracted `ValidateArchiveAsync`; it validates the article schema version, PNG signature, IHDR chunk and expected dimensions, and reads each PNG entry to EOF before final commit. This also makes cancellation observable during the validation pass.
   - **Regression coverage:** valid header, invalid signature, wrong dimensions, truncated header, and invalid article schema.

2. **Reliability — cleanup operations were sequential and unguarded.** If `renderer.Dispose()` or `renderWindow.Close()` throws a WebView2/WPF lifecycle exception, later cleanup statements could be skipped, including deletion of the task-owned staged ZIP.
   - **Change:** Each cleanup action is attempted independently; expected COM/WPF and file-system cleanup exceptions are logged without preventing later cleanup actions. The stage path remains task-specific.

### Reviewed and retained

- The stage ZIP is created with `CreateNew` in the destination directory, so the final move remains on the same volume.
- The old destination is not deleted before validation. `File.Move(stage, destination, overwrite: true)` is the sole commit operation; failures before successful move leave the old destination in place.
- Cancellation checks exist during page capture/write, after archive creation, during archive validation, and immediately before commit. The final synchronous check-and-move section has no dispatcher yield, so a UI cancellation event cannot interleave between those two statements on the WPF UI thread.
- `CardCapture` checks the raw screenshot's PNG signature and dimensions before writing it to the ZIP.
- The progress dialog's Cancel and title-bar close both request the same cancellation token; its own close is deferred until the operation completes.
- `MainWindow.OnClosing` asks whether to cancel an active export and leaves the application open after cancellation, requiring a subsequent close action. This matches the previously confirmed interaction.
- A numeric upper page-count limit is not defined by the current product contract. The request's page count is checked for positivity and then compared against the renderer's actual page count. No arbitrary maximum was introduced in this pass; a product-level cap remains an explicit specification decision if desired.

### Verification

- Static source review completed.
- Added C# regression coverage for archive validation.
- `dotnet` is not installed in this execution environment; compilation and Windows/WebView2 tests are **not run**.
- Existing user-reported 35/35 React, 58/58 Playwright and 12/12 C# results apply to the prior UserDataStore review package, not this new export patch.


## Fifth-round review — WebView2 and EditorBridge

### Important — WebView2 origin checks should parse the origin

**Evidence:** `LocalWebContent.LoadAsync` previously used `StartsWith("https://englishcards.invalid/")` for navigation and resource requests.

**Assessment:** The trailing slash blocks common lookalike-host suffixes, so this was not a demonstrated bypass. However, parsed URI comparison is clearer and explicitly constrains HTTPS, host, port and user-info.

**Action:** Replaced prefix checks with `IsLocalOrigin` and added tests for valid local paths, host case normalization, explicit default port, HTTP, lookalike hosts, user-info, non-default ports and malformed input.

### Important — Navigation completion was not correlated to the requested navigation

**Evidence:** The previous `NavigationCompleted` handler accepted the first completion event without checking `NavigationId` or final `web.Source`.

**Impact:** An unrelated or overlapping navigation completion could satisfy the wait for the requested page.

**Action:** Capture the requested `NavigationId`; accept completion only for that ID and expected final local URI. Unsubscribe the per-load handlers in `finally`.

### Important — Main window close cleanup was not exception-isolated

**Evidence:** `MainWindow.OnClosed` called `Editor.Dispose()` before `data.Dispose()` without a `finally`.

**Impact:** If WebView2 disposal throws after a browser-process failure, the single-instance lease release and base close notification could be skipped.

**Action:** Isolate disposal failures, always attempt to release the data store, clear the reference, and call `base.OnClosed`.

### Lifecycle caveat — WaitAsync does not cancel the WebView2 operation

`EnsureCoreWebView2Async` and `CallDevToolsProtocolMethodAsync` are wrapped with `WaitAsync(ct)`. Cancelling the wait does not cancel the underlying WebView2 operation. This remains a lifecycle consideration: the owning WebView2 instance must be retired/disposed after an abandoned operation, and callers must not assume cancellation stopped the browser-side work. No generalized cancellation framework was added in this round.

### Verification

- Source inspection and targeted C# regression test added.
- Windows compilation and execution not performed in this environment.
- Owner must rerun the .NET test project and exercise startup-close, browser-process failure, and ordinary editor close on Windows.


## Round 6 — React / TypeScript state and editing lifecycle (2026-11-06)

**Scope:** `useEditorViewModel`, `EditorView`, `DesktopPersistence`, desktop bridge, pagination, and existing unit/E2E coverage.

### Confirmed reliability issue: edits remained active during asynchronous project opening

- **Evidence:** `open()` in `src/viewmodels/useEditorViewModel.ts` sets `opening` while awaiting file selection/read, but the editor fields and Undo/Redo toolbar were not made inert. The existing `ready` gate disabled export, not editing.
- **Impact:** A user could keep editing the old project during an in-flight open; successful completion would then replace the working project with the opened file, discarding those new edits from the active view.
- **Fix:** Expose `opening` from the ViewModel; make only the editor fields and history toolbar inert while opening. Keep the external project action controls accessible, allowing a later Open request to supersede a slower one. Cancellation or failure restores editing. Do not modify the project schema or persistence code.
- **Regression:** Added desktop Playwright scenario for the in-flight inert state, newer-open cancellation, stale older response, and failed open recovery.

### Reviewed and retained

- `DesktopPersistence` serializes settings/draft requests and snapshots state per `save` call. The final close path enqueues the latest snapshot.
- The project file dirty marker deliberately compares document content without shared styles, preserving the separate settings contract.
- Pagination sets `ready` only when the published layout matches the current immutable project object. ZIP export uses that ready snapshot and signature.
- No broad ViewModel split, new state library, or pagination rewrite is justified by the evidence in this pass.

### Verification status

- Source and tests inspected; full and incremental archives checked for integrity.
- React/Vite and Playwright not executed in this container (project dependencies not installed).
- Owner should rerun all unit/E2E tests and the WPF build before release.


## Round 7 — Windows runtime, publishing and repository hygiene (2026-11-06)

### Confirmed findings and actions

1. **Reliability — WebView2 startup failure had no user-oriented recovery route.** `MainWindow.InitializeAsync` created the Evergreen environment and initialized the main WebView; failures propagated to `App.OnStartup`, which displayed the raw exception message. This did not satisfy `project-contract.md`'s requirement for an understandable message and Microsoft recovery entry point.
   - **Change:** Added `WebView2StartupException`; wrap only WebView2 environment creation and main-view initialization failures. `App` now shows a Chinese explanation and asks whether to open Microsoft's official Evergreen Runtime page. If the browser cannot be opened, the URL is shown for manual copying. No download or installation is automated.
   - **Regression:** Added a desktop test that checks the dedicated exception message and official Microsoft URL.

2. **.NET Desktop Runtime policy reviewed and retained.** The app is framework-dependent and its managed startup code cannot run before the .NET host has found a compatible runtime. Per the explicit project contract, no native launcher or custom runtime downloader is added. README now explicitly names the .NET 10 Desktop Runtime x64 prerequisite and official Microsoft download page.

3. **Publishing and data protection reviewed and retained.** `tools/publish.bat` builds React assets, publishes to `dist\wpf`, and does not delete the destination directory or `userdata`. It refuses to continue when it detects `coreclr.dll` from a self-contained output, rather than silently mixing deployment modes. `.gitignore` excludes `dist/`, `artifacts/dist/`, .NET `bin/obj`, test outputs and any `userdata/` directory. The reviewed source archive contains none of those generated/user-data directories.

4. **Runtime dependency boundary reviewed and retained.** `package.json` declares Node.js for development/build tooling. The WPF project embeds the Vite output; the README and project contract correctly state that Node.js/npm, Express, Vite, Playwright and Chromium are not end-user runtime requirements. WebView2 Evergreen remains a machine prerequisite.

### Verification status

- Source and project contract inspected.
- Source archive checked: no `node_modules`, `dist`, `artifacts/dist`, `desktop/bin`, `desktop/obj`, or `userdata` entries.
- Windows/.NET build, C# tests, publish output inspection, missing-runtime simulation, and clean-machine launch were **not executed in this environment**.
- Owner must run the desktop test project, publish, inspect the actual `dist\wpf` contents, and test WebView2 recovery on a Windows x64 machine.


## Round 8 — Font payload reduction and Windows CJK fallback (2026-11-06)

### Scope

Reviewed `package.json`, `package-lock.json`, `src/main.tsx`, `src/views/editor.css`, `src/services/pagination.ts`, font readiness tests, README, project contract and export contract.

### Changes

- Removed `@fontsource/noto-sans-sc` from runtime dependencies and the lockfile.
- Restricted bundled Nunito Sans imports to Latin and Latin Extended subsets, weights 400 and 800.
- Removed the Noto Sans SC font load/check requirement from pagination. The export readiness gate now waits only for the bundled Nunito Sans faces.
- Set the same CJK fallback order in editor UI and card pagination: `Microsoft YaHei UI`, `Microsoft YaHei`, `DengXian`, `sans-serif`.
- Updated cold-font regression coverage from a Cyrillic-only stress glyph to Latin Extended `Ł`, and asserted that the renderer exposes the agreed CJK fallback stack.
- Updated product and export documentation to make the system-font dependency explicit.

### Compatibility and rendering note

This is an intentional destructive dependency/resource change. No legacy font asset or migration compatibility is retained. CJK rendering now depends on fonts available on the target Windows installation. Windows language optional features and customized images can affect which named font is present; generic `sans-serif` remains the final browser fallback. Different system fonts can have different glyph metrics, so target-machine pagination and PNG export must be visually checked.

### Verification status

- Source/manifest/lockfile consistency and targeted static checks performed.
- ZIP archive integrity checked.
- npm install/build/Vitest/Playwright and Windows .NET publish were not executed in this environment because the source archive contains no `node_modules`, and package registry access is unavailable.
- Owner must run `npm.cmd ci`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:e2e`, then the .NET test and publish commands on Windows.


## Round 9 — Responsive preview and floating zoom controls (2026-11-07)

### Confirmed product behavior implemented

- Changed both pane minimum widths from 320 DIP to 280 DIP, retaining the existing 70% / 30% initial split and draggable splitter.
- Default preview mode fits one card to the preview content height, leaving 12 DIP above and below. The fit ratio uses the rendered card's untransformed height; it is recalculated when the preview viewport height changes, not when only its width changes.
- Preview cards remain horizontally centered. If a card is wider than the preview viewport, the preview scroll container provides horizontal scrolling rather than compressing the card.
- Ctrl + mouse wheel switches to manual zoom and clamps it to 40%–150%. Manual zoom is not changed by subsequent window resizing.
- Added a compact horizontal floating toolbar at the preview's top-right: non-editable percentage label plus a reset icon. It has no border, 15 DIP radius, a 95%-opaque white background, and a subtle shadow.
- Toolbar appears during zoom and on hover/focus, then fades after approximately one second without further zoom input or pointer hover. Reset switches to manual 100%. There is intentionally no separate fit-height button, per the latest user decision.
- Preview zoom remains a presentation-only transform; pagination and export rendering paths are unchanged.

### Regression coverage

- Updated splitter minimum-width assertions to 280 DIP.
- Added E2E checks for initial single-card height fit, no zoom change from width-only resizing, refit on height changes, horizontal centering, toolbar hover/timeout, manual zoom limits, reset to 100%, and persistence of manual zoom across viewport resizing.
- Updated the zoom-anchor test to verify vertical reading-position stability while preserving horizontal centering.

### Verification status

- Source, CSS, contract and test changes reviewed statically.
- `npm ci` could not complete in this environment because the package registry artifact was not available; offline install confirmed the required package tarball was not cached.
- `npm run build` therefore stopped before TypeScript compilation with missing `@types/node` and `vite/client`; Vitest and Playwright were not run.
- Full Windows verification remains required: `npm.cmd ci`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:e2e`, followed by the existing .NET tests and publish.


## Round 10 — Width-constrained preview zoom (2026-11-07)

### Current product behavior

- Removed the fit-height mode and all preview-height-based zoom calculations. Preview height is unrestricted; cards scroll vertically. The WPF main window minimum width is 600 DIP so both 280 DIP panes and the 8 DIP splitter remain available.
- Cards retain their 1200 × 1600 source dimensions and aspect ratio. The displayed width is capped by the preview content width after 8 DIP left/right padding.
- Ctrl + mouse wheel is the only zoom gesture; the middle button is not pressed. Requested zoom is bounded to 20%–100%.
- When a narrower pane forces the current zoom down, the reduced value is committed. Widening the pane does not restore the prior scale.
- Cards remain horizontally centered; horizontal overflow and the zoom toolbar/percentage/reset controls are removed.
- Pagination and export rendering are not changed.

### Verification status

- Updated E2E coverage for ordinary vertical scrolling, Ctrl + wheel zoom, centering, width cap, permanent clamping, zoom bounds and unrestricted card height.
- Source and test changes reviewed statically. `node_modules` is absent from the supplied source archive; npm build, Vitest and Playwright were not run in this environment.
- Windows .NET tests and publish remain to be run by the owner after the browser tests pass.
