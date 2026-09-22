# @tertium/js

> **⚠️ IN DEVELOPMENT** — APIs, scripts, and configuration formats in this package are still changing and may break between versions without notice. Pin an exact version rather than a range, and review the changelog/diff before upgrading.

A reusable TypeScript library providing shared core utilities, entity models, and release automation scripts for JavaScript projects. Includes abstractions for APIs, authentication, filtering, logging, repositories, and domain entities (users, posts, comments).

## Why this package exists

Across the author's JS/TS projects, the same small pieces of logic — password hashing, API response shapes, repository patterns, release/deploy scripts — kept getting hand-copied from one repo to the next, drifting apart with every copy. `@tertium/js` exists to break that cycle: it's the one place a genuinely repeatable function, type, or script gets written, so every consuming project imports it instead of reimplementing it.

That gives a concrete test for what belongs here versus what stays local to a project:

- **Belongs here**: logic that is project-agnostic — it would look the same in any app that needed it, with no dependency on one project's domain model, routes, or business rules (e.g. `hashPassword`/`verifyPassword`, the `Repo` base class, `ApiResponse` shapes, the release/deploy scripts).
- **Stays local**: anything wired to a specific app's routes, schema, or product decisions (e.g. an endpoint's request/response handling, a project's own auth middleware, domain-specific validation) — even if the *pattern* was copied from another project, the wiring itself isn't universal.

Because modules are consumed via subpath imports straight from source (no bundling — see below), a module can bring in its own runtime dependency without forcing it on projects that only import a different, dependency-free module. `core/*` and `entities/*` stay limited to `node:*` builtins for exactly this reason; anything that genuinely needs an external package lives under `libs/*` instead, with that package declared as an optional `peerDependency` the consumer installs themselves — never as a blanket dependency of the whole package.

## Table of contents

- Installation
- Usage
  - Importing modules
  - Scripts
    - Clean
    - Release
    - Changelog
    - Improve Start Scripts
    - Deploy
    - AWS Env
    - Publish Workflow
    - Git Hooks
- Contributing

## Installation

Install as a dependency or devDependency in your project:

```bash
npm install @tertium/js --save-dev
```

## Usage


### Importing modules

This package exposes subpath imports organized by domain. Import the specific modules you need rather than the package root.

#### Core utilities (`./core/*`)

Core modules provide foundational abstractions and utilities:

- **REST API**: `api-rest` — CRUD request/response types (`ApiRequestFindManyParams`, `ApiResponse<T>`, etc.); a future `api-graphql` would live alongside it for GraphQL-specific shapes rather than sharing a protocol-agnostic `api` module
- **Authentication**: `auth` — `hashPassword`/`verifyPassword` (scrypt, `node:crypto`); no external dependency
- **Data management**: `entity`, `entity-ref`, `repo` — Base classes and types for entity management and repository patterns
- **Filtering & forms**: `filter`, `form` — Types for filtering and form handling
- **Logging**: `log` — Logging service and types
- **Utilities**: `option`, `ref`, `time` — General utility types for options, references, and time handling

Example:

```typescript
import { Repo } from "@tertium/js/core/repo/repo.class";
import type { ApiResponse } from "@tertium/js/core/api-rest/api-rest.types";
import { LogService } from "@tertium/js/core/log";
```

#### Entity models (`./entities/*`)

Domain entity classes and utilities for common models:

- **User**: User entity class and utilities
- **Post**: Post entity class and utilities
- **Comment**: Comment entity class and utilities

Example:

```typescript
import { Post } from "@tertium/js/entities/post";
import { User } from "@tertium/js/entities/user";
```

#### Libraries (`./libs/*`)

Unlike `core/*`, a library under `libs/*` is allowed to carry its own runtime dependency — declared as an optional `peerDependency` of this package, so only projects that actually import that library need to install it. Each one still lives at its own subpath, so importing one library never pulls in another's dependency.

- **JWT**: `jwt` — `generateToken`/`verifyToken`/`verifyAuthHeader`, built on [jose](https://github.com/panva/jose) (a `peerDependency` — install it yourself to use this). Payload shape and signing key/algorithm are caller-supplied, so the same functions cover an HS256 shared secret or an RS256/ES256 key pair; `verifyToken`/`verifyAuthHeader` forward jose's own claim-verification options (`issuer`, `audience`, `subject`, `clockTolerance`, `maxTokenAge`, `requiredClaims`, `algorithms`) instead of reimplementing them. `resolveJwtSecret` is a `process.env`-based convenience for the common shared-secret case — **no dev-only fallback**: a missing secret throws in every environment, since a silently-generated default is a worse failure mode than a startup crash. Node/Bun/Deno-style runtimes only; the rest of the module is plain jose/Web Crypto and runs anywhere JS does.

Example:

```typescript
import { generateToken, verifyAuthHeader, resolveJwtSecret } from "@tertium/js/libs/jwt/jwt.utils.ts";

const secret = resolveJwtSecret(); // throws if JWT_SECRET is unset
const token = await generateToken({ userId: "u1", role: "ADMIN" }, secret);
```

## Scripts

Utility scripts for common development tasks. All scripts are TypeScript-based and located in `scripts/[name]/`.

Add the ones you'll actually run day-to-day (or as part of a release) to your project's `package.json`:

```json
{
  "scripts": {
    "clean": "bun node_modules/@tertium/js/scripts/clean/clean.ts",
    "improve:scripts": "bun node_modules/@tertium/js/scripts/improve-start-scripts/improve-start-scripts.ts",
    "changelog": "bun node_modules/@tertium/js/scripts/changelog/changelog.ts --dry-run",
    "version": "bun node_modules/@tertium/js/scripts/changelog/changelog.ts && git add CHANGELOG.md",
    "release:patch": "bun node_modules/@tertium/js/scripts/release/release.ts patch",
    "release:minor": "bun node_modules/@tertium/js/scripts/release/release.ts minor",
    "release:major": "bun node_modules/@tertium/js/scripts/release/release.ts major",
    "deploy": "bun node_modules/@tertium/js/scripts/deploy/deploy.ts"
  }
}
```

### Clean

Removes build and distribution directories cross-platform.

Not used by this package itself (no `build`/`dist` step here) - add a `"clean"` script in a project that has one, or invoke directly:

```bash
bun scripts/clean/clean.ts             # Remove ./dist
bun scripts/clean/clean.ts dist build  # Remove multiple directories
```

**See:** [scripts/clean/clean.md](scripts/clean/clean.md)

### Release

Automates version bumps and git workflow for npm packages.

- **Patch**: Release from main branch (hotfixes)
- **Minor/Major**: Release from develop branch (features/breaking changes)

```bash
bun run release:patch
bun run release:minor
bun run release:major
```

**See:** [scripts/release/release.md](scripts/release/release.md)

### Changelog

Generates a `CHANGELOG.md` entry from git history automatically - wired as npm's own `version` lifecycle script, so it runs on every `npm version <type>` (including via `release`, above) with no manual writing.

```bash
bun run changelog   # preview the entry for the current version without writing anything
```

**See:** [scripts/changelog/changelog.md](scripts/changelog/changelog.md)

### Improve Start Scripts

Auto-detects project framework and ensures `start` and `dev` npm scripts are properly configured.

Supports: Vite, Angular, React, SolidJS, Create React App.

```bash
bun run improve:scripts          # Check current project
bun run improve:scripts -- --update  # Update scripts
```

**See:** [scripts/improve-start-scripts/improve-start-scripts.md](scripts/improve-start-scripts/improve-start-scripts.md)

### Deploy script (`./scripts/deploy/*`)

Automated deployment tool for Node.js/Bun projects using SSH, SCP, and PM2. Loads configuration from `.env` file, copies built files to remote server, and manages PM2 process.

**Features:**
- Automatic `.env` loading and validation (rejects an unsafe `DEPLOY_PATH`)
- Builds locally before deploying (`BUILD_COMMAND`, skippable with `--skip-build`)
- Cleans the remote `DEPLOY_PATH` before every deploy, preserving `.env`
- SCP transfer of `package.json`, a lockfile, and the `dist/` directory (preserved as a folder)
- Remote dependency installation with Bun
- PM2 service management — always deletes and recreates the process with `--interpreter bun`, so it can never end up running under Node
- Static site support (skip `bun install`/PM2 for static HTML/JS apps)
- Cross-platform (Windows, macOS, Linux)

**Quick start:**

Create a `.env` file in your project:

```env
DEPLOY_USER=your-username
DEPLOY_HOST=your-server
DEPLOY_PATH=/var/www/my-app
APP_NAME=my-app
# Optional: Set to true for static sites (skips bun install and PM2)
STATIC_SITE=false
```

Add to `package.json`:

```json
{
  "scripts": {
    "deploy": "bun ./node_modules/@tertium/js/scripts/deploy/deploy.ts"
  }
}
```

Then deploy:

```bash
npm run deploy               # Builds and deploys
npm run deploy -- --skip-build   # Deploys the existing dist/ without rebuilding
```

**Usage as library:**

```typescript
import { deploy } from '@tertium/js/scripts/deploy';

// Deploy with default config (reads .env from cwd)
deploy();

// Or with custom config
deploy({
  projectDir: '/path/to/project',
  env: {
    DEPLOY_USER: 'your-username',
    DEPLOY_HOST: 'your-server',
    DEPLOY_PATH: '/var/www/my-app',
    APP_NAME: 'my-app'
  }
});
```

**See:** [scripts/deploy/deploy.md](scripts/deploy/deploy.md)

### AWS Env script (`./scripts/aws-env/*`)

Stores `.env*` files in AWS SSM Parameter Store (SecureString, free standard tier) so AWS is the
source of truth instead of a hand-maintained local file. `push` uploads a file after you edit it,
`sync` refreshes the local cache from AWS with a graceful offline fallback, `pull` force-fetches
the exact current source, `run` injects the local cache's variables into a child process (never
touches the network itself, so a connectivity issue can't block starting the app), and `deploy`
fetches a deploy-target config fresh from AWS, uses it for one deploy, and deletes it right after -
`.env.dev`/`.env.prod` never need to sit on your laptop at all.

Not used by this package itself (no deployed `.env` here) - add `"env:*"` scripts in a project that has one, or invoke directly:

```bash
bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts push                       # Upload .env after editing it
bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts push --env-file=.env.dev
bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts sync --env-file=.env.dev   # Refresh local cache; falls back to existing file if offline
bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts pull --env-file=.env.dev   # Force-fetch, fails loudly if AWS is unreachable
bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts run -- bun run dev
bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts deploy --env-file=.env.prod --skip-build
```

**See:** [scripts/aws-env/aws-env.md](scripts/aws-env/aws-env.md)

### Publish Workflow script (`./scripts/npm-publish-workflow/*`)

Generates `.github/workflows/publish.yml`, which publishes the package to npm via
[trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) on every `v*` tag push -
no `NPM_TOKEN` secret required. Detects the package manager from the lockfile and only wires up
the `lint`/`build`/`test` steps that actually exist in `package.json`.

One-time setup, not a script you run regularly - invoke directly rather than aliasing it in `package.json`:

```bash
bun scripts/npm-publish-workflow/npm-publish-workflow.ts            # Generate .github/workflows/publish.yml
bun scripts/npm-publish-workflow/npm-publish-workflow.ts -- --force # Overwrite an existing workflow file
```

**See:** [scripts/npm-publish-workflow/npm-publish-workflow.md](scripts/npm-publish-workflow/npm-publish-workflow.md)

### Git Hooks script (`./scripts/git-hooks/*`)

Generates a version-controlled `.githooks/pre-commit` hook (lint/typecheck/test) and points
`git config core.hooksPath` at it, so a broken commit can't slip through — and adds a
`prepare` script so every contributor's next install re-wires the hook path automatically,
since `.githooks/` is tracked in git unlike `.git/hooks/`.

One-time setup, not a script you run regularly - invoke directly rather than aliasing it in `package.json`:

```bash
bun scripts/git-hooks/git-hooks.ts            # Generate .githooks/pre-commit and wire it up
bun scripts/git-hooks/git-hooks.ts -- --force # Overwrite an existing hook file
```

**See:** [scripts/git-hooks/git-hooks.md](scripts/git-hooks/git-hooks.md)

## Contributing

Contributions, issues and pull requests are welcome. If you add features that change the exported types or scripts, please update the documentation here.
