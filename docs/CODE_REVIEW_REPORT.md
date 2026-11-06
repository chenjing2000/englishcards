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
