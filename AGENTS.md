# EnglishCards — Agent Instructions

Before changing this repository:

1. Read [the project contract](docs/project-contract.md).
2. Read the relevant current specifications under [docs/specs](docs/specs/).
3. For Windows desktop review, follow [the Windows App Review Skill](docs/skills/windows-app-review/SKILL.md) and its adjacent references.
4. Inspect the current Git state and preserve user changes. A source ZIP without Git metadata cannot establish branch, commit, or remote state.
5. Choose verification from the project contract. Distinguish automated tests, real Windows/WPF/WebView2 checks, and owner-reported acceptance.

## Current product contract

- A1 and A2 have merged to main (PRs #12 and #13). This **Draft PR #14** implements only authorized A3 on top of them. The full target design is in PR #11, branch `docs/readonly-reader-design-handoff-20261122`, commit `58f309e` (`docs/Implementation Plan.md`). B, C1 and C2 remain out of scope; do not merge without owner acceptance.
- Keep Windows x64 WPF + .NET 10 + WebView2 + React/TypeScript, Framework-dependent single-file publish, and EXE-sibling `userdata/`. Do not read, migrate or delete legacy LocalAppData.
- Production opens native `filetype: "script"` JSON, with optional native Vocabulary and Translation. Reject Article v6; do not convert Script into Article or add compatibility writes.
- Script uses nested paragraph/sentence arrays. Display sentence `text`, never reconstructed timed-unit text. Empty title stays empty; missing/invalid/null timings must not block reading.
- A1 uses one displayed reading page and previous/next controls. Old editing, clear, Article autosave and paired JSON + ZIP commands are removed from production.
- PNG, MP4 and playback remain unavailable. A3 adds Script-sentence selection plus a Vocabulary write dialog and per-Script layout settings only. Writes must preserve Script/Translation/media, verify exact active file identity and reject external changes.
- A2 keeps root-hidden lazy browsing, filters exact top-level filetype=script, and auto-opens a sole directly listed Script only without an active Script. Tree refresh and same-root selection must preserve the active document, page and messages; successful different-root selection invalidates the previous session. No recursive indexing, book.json requirement or media scans.
- Reuse the existing pagination measurement engine; future reading/PNG and Script-only MP4 receive separate content/layout inputs rather than duplicated algorithms.
- User changes, especially `EnglishCards/desktop/Assets/clover_icon.ico`, must never be overwritten. Develop through a separate branch and PR; never merge without explicit approval.

## Documentation authority and reading order

1. `docs/project-contract.md` is the single project-wide product and technical contract.
2. Current focused specifications in `docs/specs/` define their respective technical details.
3. `README.md` is the user/developer overview; `docs/implementation-status.md` and `docs/RELEASE_ACCEPTANCE.md` record current status and evidence.
4. Skills under `docs/skills/` provide reusable workflows.

Do not treat removed phase plans, old review reports, or historical notes as current instructions. Preserve the long-lived technical references and reference assets that remain in the repository.

## Repository layout

- `EnglishCards/`: production WPF and React/TypeScript application.
- `EnglishCards.Tests/`: .NET, Vitest and Playwright tests.
- `docs/specs/`: current contracts and technical specifications.
- `docs/skills/`: Article generation, project code review and Windows app review Skills.
- `docs/reference-assets/`: retained reference material.
- `tools/`: build, test, publish and development-only utilities.
- `dist/EnglishCards/`: sole publish output; generated and ignored.

## Change and delivery rules

- Do not change the approved schema, user-data location, deployment model, save workflow, or UI behavior without explicit approval.
- Do not modify production source when the task is documentation-only.
- Do not delete tests, reference assets, or retained Skills as part of documentation cleanup.
- Do not commit, push, tag, or change remotes unless explicitly authorized.
- Prefer targeted changes. Report exact files, verification evidence, commands, and anything not verified.
- Use the Windows App Review Skill for desktop/runtime reviews and the Project Code Review Skill for code reviews.
