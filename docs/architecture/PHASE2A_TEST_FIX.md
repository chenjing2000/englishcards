# Phase 2A Test Fix — Fixture Path Resolution

## Scope

This patch fixes the single Vitest failure reported after the Phase 2A directory migration.

## Finding

`EnglishCards.Tests/frontend/unit/model.test.ts` read its Markdown snapshots using paths relative to the process working directory:

```ts
readFileSync(`assets/projects/brainco/${filename}.md`, 'utf8')
```

After the directory migration, the fixtures live under:

```text
EnglishCards/frontend/assets/projects/brainco/
```

Vitest runs with `EnglishCards/frontend` as its root, while the test's relative path was resolved from the repository root in the reported Windows run. The test therefore looked for a non-existent root-level `assets/` directory.

## Change

The test now resolves each fixture relative to the test module using `import.meta.url`:

```ts
readFileSync(
  new URL(`../../../EnglishCards/frontend/assets/projects/brainco/${filename}.md`, import.meta.url),
  'utf8'
)
```

This removes dependence on the shell's current working directory.

## Intentionally unchanged

- The test's existing schemaVersion 5 assertions remain unchanged. They describe the current production application at this migration stage; they must be replaced when Article v6 is integrated into production.
- The test's snapshot content and two-paragraph assertions remain unchanged.
- No production application code, data model, import behavior, or UI was modified.

## Validation status

The supplied Windows log showed:
- Vite production build succeeded.
- Playwright: 61/61 passed.
- .NET tests: 17/17 passed.
- .NET publish succeeded.
- Vitest: 45/46 passed, with this fixture path as the only failure.

This patch has been statically checked against the archive paths. The complete Vitest suite must be rerun on Windows to confirm the fix. No new test pass is claimed by this patch.
