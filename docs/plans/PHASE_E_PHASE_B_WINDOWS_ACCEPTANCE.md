# Phase E — Phase B integration and Windows acceptance checklist

Status: **Frontend automation passed; .NET/publish and final WPF owner acceptance pending**
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

## Non-blocking scope notes

- Browser-only legacy JSON/TXT import and local-draft helpers remain for older non-desktop E2E fixtures. They are not part of the desktop Card Library workflow. Retire them only together with their fixtures; do not delete user-owned draft files.
- The application icon `EnglishCards/desktop/Assets/clover_icon.ico` was already present on the base branch; no separate icon migration was required.

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

## Phase E final UI stabilization and verification (2026-11-10)

Latest owner verification follow-up (2026-11-10; run from `C:\\Projects\\EnglishCards`):

- `dotnet run --project EnglishCards.Tests\\dotnet\\EnglishCards.Tests.csproj -c Release`: **19/19 PASS**. Coverage includes save coordination, atomic/exclusive file writes and cleanup, instance lease, settings/draft persistence safety, embedded React assets, WebView2 origin/startup recovery, ZIP/PNG validation, Article v6 schema boundaries and Phase E card-library operations.
- `npx.cmd tsx docs/skills/article-to-englishcards/scripts/validate-project.ts`: **PASS** (2 body paragraphs, 2 translation paragraphs, 1 vocabulary item).
- `dotnet publish EnglishCards\\desktop\\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\\EnglishCards`: **succeeded**, producing `dist\\EnglishCards\\` in 1.3 seconds.
- Owner launched `dist\\EnglishCards\\EnglishCards.exe`; confirmed the EnglishCards main window displayed normally, without a crash or automatic close. This passes the application startup check, but does not by itself establish the remaining visual/interaction acceptance below.

The latest owner-provided Windows test log is for commit `b82e37ab1b3f53eee0a2d272b79e9ecacead4beb` and records:

- `npm.cmd test`: **64/64 passed** (13 files)
- `npm.cmd run build`: TypeScript check and Vite production build succeeded. Two non-fatal Rollup annotation warnings originate in Zod dependency files.
- `npm.cmd run test:e2e`: **69/69 passed** (including Card Library error notifications, duplicate JSON creation, 320 DIP settings modal, pointer editing, save locking and ZIP/export regressions)

The owner has previously confirmed the Article v6 Skill validator passes. This latest log does not repeat that validator, .NET tests or publish, so those must not be inferred as passing for this exact head.

Current UI values and behavior:
- Preview notifications: default 360 DIP, minimum 240, maximum 480; preview-bottom center, above modal backdrops, upward stacking; normal messages expire after five seconds of active display and pause on hover; errors persist until dismissed or resolved.
- Design Settings modal: default 320 DIP, minimum 280, maximum 360; compact 60/40 settings table.
- New Card and Card Library errors appear only through the shared floating notification layer. A duplicate filename does not overwrite the existing JSON; the New Card dialog retains its title for correction.
- A successful new-card creation clears the resolved create error and reports success through a normal notification.

## Final Windows acceptance and merge record (2026-11-10)

The owner completed the remaining commands successfully on the final Phase E application code:

- `dotnet run --project EnglishCards.Tests\dotnet\EnglishCards.Tests.csproj -c Release`: **19/19 PASS**.
- `npx.cmd tsx docs/skills/article-to-englishcards/scripts/validate-project.ts`: **PASS**.
- `dotnet publish EnglishCards\desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\EnglishCards`: **succeeded**.
- `dist\EnglishCards\EnglishCards.exe`: launched successfully; owner confirmed the main window displayed normally without a crash or automatic close.

Owner's final visual/interaction acceptance:
- Notification default width is 360 DIP.
- Design Settings default width is 320 DIP and its content is fully visible.
- Duplicate-file creation errors appear in the floating notification layer above the New Card modal backdrop.
- A duplicate JSON filename is not overwritten; the title remains in the dialog, and changing it allows successful creation.
- Card Library directory-read errors and file-creation errors are shown only through the shared floating notification layer.

GitHub Actions Windows CI for PR #2 / head `70c14cd30d1d21772653ae1df00c392fd475da37`: **success**. The workflow completed dependency installation, Vitest, React production build, Playwright E2E and Windows .NET tests successfully.

Pull Request [#2](https://github.com/chenjing2000/englishcards/pull/2) was merged into `main` on 2026-11-10 using a **merge commit**, preserving the feature branch history. Merge commit: `8e47296dfa484f4f807550578ce9f3b147ad466e`.

Phase E final acceptance is complete. Keep the existing rule that releases/upgrades must not delete `userdata/`; do not remove user-owned legacy draft files.
