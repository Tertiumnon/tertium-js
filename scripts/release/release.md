# Release

Automates the release process for npm packages with support for patch, minor, and major version bumps.

## What It Does

Handles the complete release workflow with proper state verification:
- **Verifies branch**: Ensures you're on the correct branch before proceeding
- **Syncs with remote**: Pulls latest changes before starting (prevents conflicts)
- **Updates version**: Bumps version in `package.json` using `npm version`
- **Creates tags**: Git tags for version tracking
- **Pushes commits**: Pushes to correct branch with tags
- **Merges properly**: For major/minor, merges develop → main with proper sync
- **Syncs branches**: Ensures both main and develop are up-to-date after release
- **Error handling**: Exits gracefully if any step fails

## Usage

### Release types

```bash
# Patch release (from main branch)
bun scripts/release/release.ts patch
node node_modules/@tertium/js/scripts/release/release.ts patch

# Minor release (from develop branch)
bun scripts/release/release.ts minor
node node_modules/@tertium/js/scripts/release/release.ts minor

# Major release (from develop branch)
bun scripts/release/release.ts major
node node_modules/@tertium/js/scripts/release/release.ts major
```

### Add to package.json
```json
{
  "scripts": {
    "release:patch": "bun scripts/release/release.ts patch",
    "release:minor": "bun scripts/release/release.ts minor",
    "release:major": "bun scripts/release/release.ts major"
  }
}
```

## Release Workflows

### Patch Release (hotfix)
```
main branch:
  1. Checkout main
  2. npm version patch
  3. git push & git push --tags
  4. Checkout develop
  5. git rebase main
  6. git push
  7. Back to main
```

Use for bug fixes and hotfixes.

### Minor Release (features)
```
develop branch:
  1. Checkout develop
  2. npm version minor
  3. git push & git push --tags
  4. Checkout main
  5. git merge develop
  6. git push
  7. Back to develop
```

Use for new features.

### Major Release (breaking changes)
```
develop branch:
  1. Checkout develop
  2. npm version major
  3. git push & git push --tags
  4. Checkout main
  5. git merge develop
  6. git push
  7. Back to develop
```

Use for breaking changes.

## Requirements

- Git repository with both `main` and `develop` branches
- Git remotes properly configured
- Correct branch checked out when running the script
- npm or yarn for version management

## Error Handling

- Exits with code 1 if any git or npm command fails
- Prints command being executed for transparency
- Requires valid release type (patch, minor, major)

## Example

```bash
# Prepare your changes on develop branch
git checkout develop
# ... make your changes ...
git add .
git commit -m "feat: add new feature"
git push

# Release minor version
npm run release:minor
# Or directly:
bun scripts/release/release.ts minor
```
