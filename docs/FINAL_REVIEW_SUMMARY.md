> **历史记录：** 本文记录较早的实施阶段，可能包含旧目录、schemaVersion 5 或旧发布路径。当前有效目录、Article v6 契约和实施状态以 [`docs/project-contract.md`](project-contract.md) 与 [`docs/implementation-status.md`](implementation-status.md) 为准。

# EnglishCards — Review Closure Summary

Date: 2026-11-06  
State: **Seven rounds reviewed, font optimization accepted by owner; release candidate, not final release.**

## Scope closure

| Stage | Outcome |
|---|---|
| Project structure and contract | Completed; `AGENTS.md`, focused specs and review plan |
| Core code/test baseline | Completed; bridge exception fix and regression updates |
| UserDataStore | Completed static review and focused persistence regressions |
| ZipExportService | Completed targeted PNG validation/cleanup hardening |
| WebView2 / EditorBridge | Completed exact local origin and navigation lifecycle hardening |
| React / TypeScript | Completed async-open editing lock with regression coverage |
| Windows publish | Completed runtime-failure guidance and source hygiene review |
| Bundled font optimization | Completed; removed embedded Noto Sans SC, limited Nunito subsets |

## Owner-provided evidence for latest source

- `npm.cmd ci` succeeded; **184 packages** installed.
- Vitest **35/35**, Playwright **59/59**, .NET desktop **16/16**.
- TypeScript and Vite production build succeeded.
- Windows `dotnet publish` to `dist\wpf` succeeded with framework-dependent single-file setting.
- EXE size measured by owner: **14.9 MB before → 1.9 MB after**.
- Chinese text visual comparison between card preview and PNG exports showed no obvious discrepancy on tested Windows environment.
- Two nonfatal build notices were observed: esbuild install-script approval notice from npm and Rollup/Zod comment warnings.

## Evidence boundaries

This final documentation handoff includes **source only**. The actual `EnglishCards.exe` and published Windows runtime artifacts were not supplied to this environment and cannot be built here. The owner must produce the release binary on Windows and complete the clean-machine checks in [`RELEASE_ACCEPTANCE.md`](RELEASE_ACCEPTANCE.md). Successful unit/E2E tests do not independently verify missing-runtime prompts, fresh Windows font configurations, or preservation through in-place upgrades.

## Repository hygiene

Source ZIP intentionally excludes Git metadata, `userdata/`, `node_modules/`, `bin/`, `obj/`, `dist/`, `artifacts/dist/`, test reports and temporary files. Retained `assets/` are test fixtures/reference resources; redistribution rights have not been approved automatically.

No third-party font license files are included in the runtime package by this source ZIP. Review distributable licenses/attribution for retained third-party dependencies before public release as appropriate.

## Versioning and Git

Earlier notes mention `v0.1.0`, while package metadata is `1.0.0`. Do not tag until one consistent public version is chosen. Do not delete previous history, overwrite uncommitted changes, or push without explicit instruction.

Suggested English commit message for the documentation-only closure:

```text
docs: prepare EnglishCards release candidate handoff

- Record verified Windows test and publish results
- Document clean-machine acceptance and userdata preservation checks
- Summarize seven review rounds and font payload optimization
- Note pending version and redistribution decisions
```
