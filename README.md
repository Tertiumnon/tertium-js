# @tertium/js

Shared JavaScript utilities, release scripts and TypeScript types you can reuse across projects.

## Table of contents

- Installation
- Usage
  - TypeScript types
  - Release scripts
  - Cleaning build folders
- Contributing

## Installation

Install as a dependency or devDependency in your project:

```bash
npm install @tertium/js --save-dev
```

## Usage

### TypeScript types

This package exports shared TypeScript types you can import directly:

```typescript
// Import multiple types
import { ApiResponse, ApiRequest, Repo, Option, Ref } from '@tertium/js';

// Or import a single type
import { ApiResponse } from '@tertium/js';
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
# Remove default (./dist)
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

