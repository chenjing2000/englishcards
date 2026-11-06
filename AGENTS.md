# EnglishCards — Agent Instructions

Before changing this repository:

1. Read [`docs/project-contract.md`](docs/project-contract.md).
2. Read the relevant specifications under [`docs/specs/`](docs/specs/).
3. For Windows desktop review, follow [`docs/skills/windows-app-review/SKILL.md`](docs/skills/windows-app-review/SKILL.md) and its adjacent reference documents.
4. Inspect the current working tree and preserve user changes. A source ZIP without `.git` metadata cannot establish branch, commit, or remote state.
5. Choose verification from the project contract. Distinguish automated tests, real Windows/WebView2 checks, and owner-reported historical acceptance.

## Product boundaries

- Product: Windows x64 desktop application using WPF + WebView2 + React/TypeScript.
- Keep React as the editing UI and WebView2 as its renderer. Do not migrate to Tauri, Electron, or pure WPF.
- Keep the current lightweight separation. Do not add an MVVM framework, DI container, event bus, or abstraction without a demonstrated need.
- The only official export is the complete ZIP containing `article.json` and all page PNGs. Do not restore single-page export.
- Preserve schemaVersion 5 and the confirmed EXE-sibling `userdata/` contract.
- Do not migrate, read, or delete old `%LOCALAPPDATA%\EnglishCards` data.
- The target machine needs compatible .NET 10 Desktop Runtime x64 and WebView2 Evergreen. If .NET Desktop Runtime is missing, direct the user to Microsoft's official installer; do not add a native launcher or custom runtime downloader.
- Node.js/npm, Express, Vite, TypeScript, Playwright and Chromium are development/build/test tools only, not end-user runtime dependencies.

## Change and delivery rules

- Do not change confirmed UI behavior, schema, user-data paths, runtime deployment mode, or ZIP semantics without explicit approval.
- Do not delete user data, sample projects, reference assets, tests, or historical records merely to reduce tree size.
- Do not commit, push, tag, or modify remotes unless explicitly authorized.
- Prefer targeted fixes with regression tests. Report exact files, evidence, commands, and anything not verified.
- Prefer direct `dotnet publish`; if a wrapper is useful, use `.bat`, not `.ps1`, as the publishing entry point.
