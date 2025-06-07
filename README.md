# @tertium/shared-js-configs-and-types

## List

- BiomeJS
- Release Scripts
- TypeScript Types

## TypeScript Types

This package provides shared TypeScript type definitions that can be imported in your projects:

```typescript
// Import all types
import { ApiResponse, ApiRequest, Repo, Option, Ref } from '@tertium/shared-js-configs-and-types';

// Or import specific types
import { ApiResponse } from '@tertium/shared-js-configs-and-types';
```

### Available Types

- **API Types**
  - `ApiResponse`: Common API response structures
  - `ApiRequest`: Common API request structures

- **Repository Types**
  - `Repo`: Repository-related type definitions

- **Form Types**
  - `Option`: Form option/select types

- **Common Types**
  - `Ref`: Reference type definitions

## Release Scripts

This package provides Node.js scripts for managing releases:

```js
// Import the release script
const release = require('@tertium/shared-js-configs-and-types/scripts/release');
```

### Usage

You can use the scripts directly in your package.json:

```json
"scripts": {
  "release:patch": "node node_modules/@tertium/shared-js-configs-and-types/scripts/release.js patch",
  "release:minor": "node node_modules/@tertium/shared-js-configs-and-types/scripts/release.js minor",
  "release:major": "node node_modules/@tertium/shared-js-configs-and-types/scripts/release.js major"
}
```

### Release Types

- **Patch Release**: Updates from main branch, then rebases develop
  - Workflow: checkout main → bump version → push → checkout develop → rebase → push → checkout main
  
- **Minor/Major Release**: Updates from develop branch, then merges to main
  - Workflow: checkout develop → bump version → push → checkout main → merge develop → push → checkout develop
