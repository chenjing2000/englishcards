# EnglishCards — Agent Instructions

Before changing this repository:

1. Read [the project contract](docs/project-contract.md).
2. Read the relevant current specifications under [docs/specs](docs/specs/).
3. For Windows desktop review, follow [the Windows App Review Skill](docs/skills/windows-app-review/SKILL.md) and its adjacent references.
4. Inspect the current Git state and preserve user changes. A source ZIP without Git metadata cannot establish branch, commit, or remote state.
5. Choose verification from the project contract. Distinguish automated tests, real Windows/WPF/WebView2 checks, and owner-reported acceptance.

## Current product contract

- Product: Windows x64 desktop application using WPF + .NET 10 + WebView2 + React/TypeScript. Do not migrate to Tauri, Electron, or pure WPF.
- The only supported Article format is strict Article `schemaVersion: 6`. Reject v5 and earlier; do not silently migrate, dual-write, or retain a production v5 path.
- Article fields are `schemaVersion`, `id`, `title`, `identityTag`, `content.paragraphs`, `vocabulary`, and `translation.paragraphs`. Paragraph groups each allow at most 999 entries; Vocabulary allows at most 999 entries. Vocabulary uses `word` for words, phrases, and idioms.
- Card Library opens independent JSON files from a lazily browsed directory tree. There is no legacy global-draft auto-recovery and no desktop JSON/TXT import UI.
- The toolbar offers Clear current article and Save JSON + ZIP (alongside Settings). Save produces same-basename JSON and ZIP from one validated Article v6 snapshot. Nonempty articles require clear confirmation; preview remains displayed during normal edits, JSON autosave and paired-save dialogs. The Save-button star reflects changes not yet committed to a paired JSON + ZIP save in the current session. See [combined save](docs/specs/COMBINED_ARTICLE_SAVE.md) and [Phase E](docs/specs/PHASE_E_CARD_LIBRARY.md).
- Saving blocks card switching; blocked clicks are discarded, not queued.
- User data lives in EXE-sibling `userdata/`. Do not migrate, read, or delete legacy `%LOCALAPPDATA%\\EnglishCards` data. Keep the Framework-dependent single-file publish model.
- .NET 10 Desktop Runtime x64 and WebView2 Evergreen are end-user prerequisites. Node/npm, Vite, Playwright and Chromium are development tools only.

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
