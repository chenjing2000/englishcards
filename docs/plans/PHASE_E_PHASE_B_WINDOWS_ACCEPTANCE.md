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

## Follow-up corrections from November 10 Windows acceptance

- Left side uses the ReadArticles library chooser presentation: only the `选择卡片馆` button, no `卡片馆` heading and no refresh button. Expanding folders uses the same teal circle plus/minus SVG assets as ReadArticles, and a white tree with its muted-beige selected row.
- By default, the library points to the executable-adjacent `userdata` directory. If a previously chosen folder cannot be read, return to the default. Runtime-only `userdata/cache`, `settings`, `drafts`, `exports`, `temp` and `logs` are hidden from the library view; **they are not deleted from disk**. In particular, the WebView2 cache may still be in use.
- The design/new-card/export ZIP SVG buttons are directly below the editor heading on a separate, right-aligned row.
- The design/settings surface and new-card title input are centered in the current application window. Entering a title shows the generated file name; creation remains atomic and never overwrites an existing JSON file.
- Before any card is opened, an explicit empty-state prompt is displayed instead of disabled form controls or a sample preview.
- Verify left-click editing of title/vocabulary/content and wheel scrolling **after a JSON has actually opened**. The desktop E2E now includes a pointer and wheel check; real WPF behavior still needs owner acceptance.
- User-managed folders and JSON naming remain independent. No automatic folder deletion or card-directory database.
