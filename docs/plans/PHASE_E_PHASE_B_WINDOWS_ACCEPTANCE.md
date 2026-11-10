# Phase E — Phase B integration and Windows acceptance checklist

Status: **Candidate only; not yet Windows-validated**
Branch: `feature/phase-e-card-library`

## Automated verification

From the repository root on Windows PowerShell 5.1:

```powershell
git fetch origin
git switch feature/phase-e-card-library
git pull --ff-only origin feature/phase-e-card-library
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
dotnet run --project EnglishCards.Tests\dotnet\EnglishCards.Tests.csproj -c Release
dotnet publish EnglishCards\desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\EnglishCards
```

Close any running `EnglishCards.exe` before publishing. Do **not** remove `dist/EnglishCards/userdata`.

Do not treat test code being committed as evidence that these commands passed.

## Owner Windows acceptance

Use a **new test directory**, not an existing valuable collection of JSON cards.

1. Start the executable and select the test directory through **选择目录**. Confirm it loads only immediate JSON files and child folders on demand.
2. Open an existing Article v6 JSON card. Change the title, body, translation and vocabulary. Check the **same original JSON** is updated automatically, without a Save JSON dialog.
3. Confirm edits to the active JSON file are visible after restarting the application.
4. During a pending automatic save, click a different JSON card. The switch must be rejected and no target queued; after save completes, click the target again to switch. The automated delayed-save E2E covers this condition deterministically.
5. Click **新建卡片**, pick a name, and confirm a fresh v6 JSON appears in the directory tree. Attempt a duplicate name in a test folder: the existing file must not change.
6. With a card open and saved, use **导出 ZIP**. Check `article.json`, PNG pages, cancellation and existing ZIP overwrite behavior.
7. Edit a card externally in another text editor while EnglishCards has it open; then edit in EnglishCards. Confirm save refuses to overwrite the external edit and exposes a persistent error/retry path. Do this only with disposable files.
8. Check **设置** and the default-style action. Old **导入配置** must not be offered.
9. Confirm older `userdata/drafts` content is neither automatically loaded nor automatically deleted.

## Known incomplete scope

- The settings surface is still an editor-region panel; its final in-workspace modal presentation is Phase C2.
- Notification stacking, preview-bottom positioning and five-second normal-message expiry are Phase C3.
- Legacy draft and import helpers remain in some non-desktop/test code. The desktop boot/save flow no longer reads/writes the global article draft; final dead-code cleanup and obsolete test migration remain to be completed.
- Not all earlier E2E tests are guaranteed to remain compatible; report any failures rather than hiding or skipping them.

## Evidence

Record command exit codes, all failing test names with stack traces, and the exact commit SHA. Distinguish automated tests from actual WPF/WebView2 acceptance.
