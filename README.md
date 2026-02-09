# @tertium/js

A reusable TypeScript library providing shared core utilities, entity models, and release automation scripts for JavaScript projects. Includes abstractions for APIs, authentication, filtering, logging, repositories, and domain entities (users, posts, comments).

## Table of contents

- Installation
- Usage
  - Importing modules
  - Release scripts
  - Cleaning build folders
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

### Release scripts

This package ships Node.js release helper scripts in `scripts/`. You can invoke them from your project's `package.json` by referencing the script file in `node_modules`:

```json
{
  "scripts": {
    "release:patch": "node node_modules/@tertium/js/scripts/release.js patch",
    "release:minor": "node node_modules/@tertium/js/scripts/release.js minor",
    "release:major": "node node_modules/@tertium/js/scripts/release.js major"
  }
}
```

Briefly:

- Patch release: bump from `main`, rebase `develop`.
- Minor/Major releases: bump from `develop`, merge to `main`.

(See the script comments in `scripts/release.js` for full workflows.)

### Cleaning build folders

This package provides a small cross-platform cleaner at `scripts/clean.js` that removes folders such as `dist`.

Notes:

- The script resolves paths from the current working directory and will skip targets that don't exist.
- It prefers `fs.rmSync` (Node 14.14+) and falls back to a small recursive remover for older Node versions.
- The script logs removed and skipped paths and sets a non-zero exit code on failure.

#### Using this script in your own repository

If you consume `@tertium/js` from another project, reference the script directly in your `package.json` scripts:

```json
{
  "scripts": {
    "clean": "node node_modules/@tertium/js/scripts/clean.js",
    "clean:dist": "node node_modules/@tertium/js/scripts/clean.js dist"
  }
}
```

Then run from your project:

```powershell
# Delete default (./dist)
npm run clean

# Pass multiple targets
npm run clean -- dist build .cache

# Run the dist shortcut
npm run clean:dist
```

Notes for consumers:

- Ensure `@tertium/js` is installed (as a dependency or devDependency) so the `node_modules` path exists.
- If you'd prefer a CLI-style experience (invokable via `npx`/`pnpm dlx`), we can add a `bin` entry to this package — tell me if you want that and I will add it and update README usage.

## Contributing

Contributions, issues and pull requests are welcome. If you add features that change the exported types or scripts, please update the documentation here.
