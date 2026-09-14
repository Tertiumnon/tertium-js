# Publish Workflow

Generates a GitHub Actions workflow that publishes a package to npm using
[trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) instead of
a long-lived `NPM_TOKEN` secret.

## What It Does

1. **Detects** the package manager from the lockfile present (`bun`, `pnpm`, `yarn`, or `npm`)
2. **Detects** whether the project is TypeScript (`tsconfig.json` present, or `typescript` in
   `dependencies`/`devDependencies`). TypeScript projects always get `Lint` (`lint`) and
   `Typecheck` (`typecheck`) steps — the @tertium convention — even if those scripts aren't
   defined yet, so CI fails loudly instead of silently skipping the check. Non-TS projects
   fall back to only including `Lint` if a `lint` script actually exists, and skip
   `Typecheck` entirely
3. **Detects** whether `build` and `test` exist in `package.json` and only includes those
   steps if present, for any project type
4. **Writes** `.github/workflows/publish.yml`, triggered on `v*` tag pushes (matches the
   tags `scripts/release/release.ts` already creates) or manual dispatch
5. **Refuses** to run against a `"private": true` package, or to overwrite an existing
   workflow file, unless `--force` is passed

The generated workflow always runs the final `npm publish` step through the npm CLI
(trusted publishing is an npm-CLI feature) even when a different tool installed/built/tested
the project.

## Usage

### Generate for the current project
```bash
bun scripts/publish-workflow/publish-workflow.ts
node node_modules/@tertium/js/scripts/publish-workflow/publish-workflow.ts
```

### Generate for a specific project
```bash
bun scripts/publish-workflow/publish-workflow.ts /path/to/project
```

### Overwrite an existing workflow / force a private package
```bash
bun scripts/publish-workflow/publish-workflow.ts --force
```

### Show help
```bash
bun scripts/publish-workflow/publish-workflow.ts --help
```

## Adding to Your Project

```json
{
  "scripts": {
    "workflow:publish": "bun node_modules/@tertium/js/scripts/publish-workflow/publish-workflow.ts"
  }
}
```

## One-time npmjs.com setup

The generated workflow will fail to authenticate until you also configure the trusted
publisher on npmjs.com - this is a manual, one-time step the script cannot do for you:

1. Go to `https://www.npmjs.com/package/<your-package>/access`
2. Under **Trusted Publisher**, add a GitHub Actions publisher with:
   - Organization or user: your GitHub org/user
   - Repository: this repo's name
   - Workflow filename: `publish.yml`
   - Environment name: leave blank unless the workflow was edited to add one
3. No `NPM_TOKEN` secret is required — the workflow authenticates via short-lived OIDC tokens.

## Requirements

- npm CLI 11.5.1+ and Node 22.14.0+ (the generated workflow pins `node-version: "lts/*"`,
  which satisfies this)
- GitHub-hosted runners only — self-hosted runners aren't supported by npm trusted publishing
- Public repository, or a paid npm plan, for provenance attestations to be generated

## What It Does NOT Do

- Does not configure the trusted publisher on npmjs.com (see above — manual step)
- Does not remove or rotate an existing `NPM_TOKEN` secret
- Does not add a separate CI (lint/test-on-PR) workflow — only the publish-on-tag workflow
