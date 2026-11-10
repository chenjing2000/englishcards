# EnglishCards — Agent Instructions

Before changing this repository:

1. Read [`docs/project-contract.md`](docs/project-contract.md).
2. Read the relevant specifications under [`docs/specs/`](docs/specs/).
3. For Windows desktop review, follow [`docs/skills/windows-app-review/SKILL.md`](skills/windows-app-review/SKILL.md) and its adjacent reference documents.
4. Inspect the current working tree and preserve user changes. A source ZIP without `.git` metadata cannot establish branch, commit, or remote state.
5. Choose verification from the project contract. Distinguish automated tests, real Windows/WebView2 checks, and owner-reported historical acceptance.

## Product boundaries

- Product: Windows x64 desktop application using WPF + WebView2 + React/TypeScript. Keep this stack; do not migrate to Tauri, Electron, or pure WPF.
- Keep the current lightweight separation. Do not add an MVVM framework, DI container, event bus, or abstraction without a demonstrated need.
- The approved target data contract is **Article schemaVersion 6**. The v5 model remains only as a temporary implementation baseline during the coordinated migration; do not add new v5 features, dual-write schemas, or compatibility migrations. Remove the v5 runtime path when the v6 integration phase is complete.
- Article v6 is deliberately incompatible with v5. Its fields and limits are specified in [`docs/architecture/ARTICLE_V6_PHASE1.md`](docs/architecture/ARTICLE_V6_PHASE1.md) and the Article v6 module under `EnglishCards/frontend/src/v6/`.
- The only official user export remains a complete ZIP containing `article.json` and all page PNGs. Preserve the confirmed ZIP semantics while updating its JSON payload to Article v6 during integration.
- Preserve the confirmed EXE-sibling `userdata/` contract. Do not migrate, read, or delete old `%LOCALAPPDATA%\EnglishCards` data unless the user explicitly changes this decision.
- The target machine needs compatible .NET 10 Desktop Runtime x64 and WebView2 Evergreen. If .NET Desktop Runtime is missing, direct the user to Microsoft's official installer; do not add a native launcher or custom runtime downloader.
- Node.js/npm, Express, Vite, TypeScript, Playwright and Chromium are development/build/test tools only, not end-user runtime dependencies.

## Repository structure

- `EnglishCards/`: all production functionality and runtime assets. WPF source is under `desktop/`; React/TypeScript source and frontend assets are under `frontend/`.
- `EnglishCards.Tests/`: .NET tests under `dotnet/`; Vitest and Playwright tests under `frontend/`.
- `docs/`: architecture, specifications, review records, plans, and reference material.
- `docs/skills/`: project and development Skills, maintained alongside project documentation.
- `tools/`: build, test, publish, comparison, demo, and development-only test-server tools.
- `dist/EnglishCards/`: the single official publish output. Do not create parallel publish folders such as `dist/wpf`, `publish`, or `release`.
- `EnglishCards/.build/` and root `.build/`: disposable generated build/test output. There is no permanent `artifacts/` directory.

## Change and delivery rules

- The user's currently approved Article v6 and directory decisions override historical v5 documentation and plans.
- Do not change confirmed user-data location, runtime deployment mode, primary UI behavior, or ZIP semantics without explicit approval.
- Do not delete user data, sample projects, reference assets, tests, or historical records merely to reduce tree size.
- Do not commit, push, tag, or modify remotes unless explicitly authorized.
- Prefer targeted changes with regression tests. Report exact files, evidence, commands, and anything not verified.
- Prefer direct `dotnet publish`; if a wrapper is useful, use `.bat`, not `.ps1`, as the publishing entry point.
- Do not claim the v6 migration is complete until the WPF bridge, automatic draft, project open/save, editor, preview, and ZIP export all use the same validated Article v6 snapshot.
