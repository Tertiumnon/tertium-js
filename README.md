# @tertium/js

> **⚠️ IN DEVELOPMENT** — APIs, scripts, and configuration formats in this package are still changing and may break between versions without notice. Pin an exact version rather than a range, and review the changelog/diff before upgrading.

A reusable TypeScript library providing shared core utilities, entity models, and release automation scripts for JavaScript projects. Includes abstractions for APIs, authentication, filtering, logging, repositories, and domain entities (users, posts, comments).

## Table of contents

- Installation
- Usage
  - Importing modules
  - Scripts
    - Clean
    - Release
    - Improve Start Scripts
    - Deploy
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

- **API & HTTP**: `api`, `api-request`, `api-response` — Types and utilities for API communication
- **Authentication**: `auth` — Auth helpers and utilities
- **Data management**: `entity`, `entity-ref`, `repo` — Base classes and types for entity management and repository patterns
- **Filtering & forms**: `filter`, `form` — Types for filtering and form handling
- **Logging**: `log` — Logging service and types
- **Utilities**: `option`, `ref`, `time` — General utility types for options, references, and time handling

Example:

```typescript
import { Repo } from "@tertium/js/core/repo";
import type { ApiResponse } from "@tertium/js/core/api-response";
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

## Scripts

Utility scripts for common development tasks. All scripts are TypeScript-based and located in `scripts/[name]/`.

Add scripts to your project's `package.json`:

```json
{
  "scripts": {
    "clean": "bun node_modules/@tertium/js/scripts/clean/clean.ts",
    "improve:scripts": "bun node_modules/@tertium/js/scripts/improve-start-scripts/improve-start-scripts.ts",
    "release:patch": "bun node_modules/@tertium/js/scripts/release/release.ts patch",
    "release:minor": "bun node_modules/@tertium/js/scripts/release/release.ts minor",
    "release:major": "bun node_modules/@tertium/js/scripts/release/release.ts major",
    "deploy": "bun node_modules/@tertium/js/scripts/deploy/deploy.ts"
  }
}
```

### Clean

Removes build and distribution directories cross-platform.

```bash
bun run clean                    # Remove ./dist
bun run clean -- dist build     # Remove multiple directories
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

## Contributing

Contributions, issues and pull requests are welcome. If you add features that change the exported types or scripts, please update the documentation here.
