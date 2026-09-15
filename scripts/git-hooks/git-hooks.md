# Git Hooks

Generates a version-controlled `pre-commit` hook (lint/typecheck/test) so a broken commit
can't slip through the way one just did — and shares it with every contributor instead of
requiring each person to set it up by hand.

## What It Does

1. **Detects** the package manager from the lockfile present (`bun`, `pnpm`, `yarn`, or `npm`)
2. **Detects** whether the project is TypeScript (`tsconfig.json` present, or `typescript` in
   `dependencies`/`devDependencies`). TypeScript projects always get `lint` and `typecheck`
   checks in the hook — the same @tertium convention enforced by
   [`scripts/npm-publish-workflow`](../npm-publish-workflow/npm-publish-workflow.md) — even if those
   scripts aren't defined yet, so the hook fails loudly instead of silently skipping the
   check. `test` is only included if the project actually defines a `test` script
3. **Writes** `.githooks/pre-commit` and runs `git config core.hooksPath .githooks`
4. **Adds** a `"prepare": "git config core.hooksPath .githooks"` script to `package.json`, so
   every contributor's next `bun install`/`npm install` re-wires the hook path automatically —
   `.githooks/` is tracked in git, unlike `.git/hooks/`
5. **Refuses** to overwrite an existing hook file unless `--force` is passed

## Usage

### Generate for the current project
```bash
bun scripts/git-hooks/git-hooks.ts
node node_modules/@tertium/js/scripts/git-hooks/git-hooks.ts
```

### Generate for a specific project
```bash
bun scripts/git-hooks/git-hooks.ts /path/to/project
```

### Overwrite an existing hook
```bash
bun scripts/git-hooks/git-hooks.ts --force
```

### Show help
```bash
bun scripts/git-hooks/git-hooks.ts --help
```

## Adding to Your Project

```json
{
  "scripts": {
    "hooks:install": "bun node_modules/@tertium/js/scripts/git-hooks/git-hooks.ts"
  }
}
```

## Why not `.git/hooks/` directly?

`.git/hooks/` is never committed — a hook written there only exists on the machine that
wrote it. Writing to a tracked `.githooks/` directory and pointing `core.hooksPath` at it
(plus a `prepare` script to re-point it after every install) means the hook actually reaches
every clone and every teammate.

## What It Does NOT Do

- Does not install husky or any other dependency — the hook is a plain POSIX `sh` script
- Does not add a `pre-push` hook — only `pre-commit`
- Does not run on Windows without Git for Windows' bundled `sh.exe` (installed alongside Git)
