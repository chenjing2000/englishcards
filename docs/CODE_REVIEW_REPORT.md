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
