# EnglishCards Phase 2A — directory and build-path migration

Date: 2026-11-07

## Scope

This phase reorganizes source, tests, skills, tooling and generated outputs. It does **not** connect Article v6 to the production editor, WPF bridge, automatic draft, or ZIP export. The running application remains on its prior v5 data model until the next coordinated integration phase.

## Directory moves

| Previous location | New location | Purpose |
|---|---|---|
| `desktop/` | `EnglishCards/desktop/` | WPF production source |
| `src/` | `EnglishCards/frontend/src/` | React/TypeScript production source |
| `assets/projects/` | `EnglishCards/frontend/assets/projects/` | Runtime sample project assets |
| `assets/reference/` | `docs/reference-assets/` | Historical reference snapshots and fixtures |
| `index.html`, `render.html` | `EnglishCards/frontend/` | Vite frontend entry documents |
| `tests/*.test.ts`, `tests/v6/` | `EnglishCards.Tests/frontend/unit/` | Vitest tests |
| `tests/e2e/` | `EnglishCards.Tests/frontend/e2e/` | Playwright tests |
| `desktop/EnglishCards.Tests/` | `EnglishCards.Tests/dotnet/` | .NET desktop tests |
| `docs/skills/` | `skills/` | Root-level project Skills |
| `src/server/` | `tools/test-server/` | Development-only Express test server |

Repository-level manifests (`package.json`, `package-lock.json`, `tsconfig.json`) remain at the root because they coordinate build and test tools across the WPF, frontend and test projects.

## Build and output changes

- Vite output: `EnglishCards/.build/frontend-dist/`.
- WPF embeds the generated output from `../.build/frontend-dist/` relative to `EnglishCards/desktop/`.
- Playwright output and test runtime data: root `.build/`.
- Desktop verification output: `.build/desktop/verification/`.
- The permanent `artifacts/` directory is removed from the build/test contract.
- The only publish target is `dist/EnglishCards/`.
- `.build/`, `EnglishCards/.build/`, `dist/`, .NET `bin/obj/`, `node_modules/`, and `userdata/` are ignored by Git.

## Configuration updates

- `tools/vite.config.ts` points to `EnglishCards/frontend/`, aliases the frontend, fixtures and test server, and discovers Vitest files under `EnglishCards.Tests/frontend/unit/`.
- `tools/playwright.config.ts` points to `EnglishCards.Tests/frontend/e2e/` and stores generated output under `.build/`.
- `tsconfig.json` maps `@frontend/*`, `@fixtures/*`, and `@test-server/*` to the new paths.
- `package.json` runs the development test server from `tools/test-server/index.ts`.
- `EnglishCards/desktop/EnglishCards.csproj` embeds the new Vite output location.
- `EnglishCards.Tests/dotnet/EnglishCards.Tests.csproj` references `EnglishCards/desktop/EnglishCards.csproj`.
- `tools/publish.bat` publishes to `dist/EnglishCards/` and does not remove `userdata/`.

## Documentation and Skills

- `AGENTS.md`, `README.md`, `docs/project-contract.md`, active specifications and implementation status now describe the target v6 contract and the new repository layout.
- `skills/article-to-englishcards/` now emits Article v6 only and validates through `parseArticleV6`.
- Historical reports and plans remain available but are explicitly marked as historical; their old paths/schema references are not current instructions.

## Static checks performed in this environment

- All relative TypeScript/TSX imports resolve to existing files after the move.
- `package.json` and `tsconfig.json` parse as valid JSON.
- Both .NET project files parse as valid XML.
- The WPF embedded-resource and .NET test project-reference paths point to the intended new locations.
- The Article v6 Skill example parses as JSON and declares schemaVersion 6.
- Old top-level `desktop/`, `src/`, `tests/`, `assets/`, and `artifacts/` directories are absent.
- `node_modules/` and generated outputs are excluded from the source archive.

## Not verified here

The environment could not complete `npm ci` because dependency installation timed out, and it does not provide the Windows/.NET SDK required for WPF builds. Therefore no post-migration Vitest, Vite build, Playwright, .NET test or WPF publish result is claimed. The owner's prior Windows log (46 Vitest tests, 61 Playwright tests, and successful .NET publish) applies to the pre-migration directory tree.

## Required Windows verification

Run from repository root:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
dotnet run --project EnglishCards.Tests\dotnet\EnglishCards.Tests.csproj -c Release
dotnet publish EnglishCards\desktop\EnglishCards.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist\EnglishCards
```

Confirm Vite creates `EnglishCards/.build/frontend-dist/index.html`, `render.html`, JS/CSS bundles and fonts; confirm WPF embeds them and the published application starts. Test outputs must appear under `.build/`, not a permanent `artifacts/` directory. Do not use the new publish command against a directory containing live user data without first preserving it; the output target is `dist/EnglishCards/` and `userdata/` must remain untouched.
