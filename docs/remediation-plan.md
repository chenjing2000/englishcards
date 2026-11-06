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
