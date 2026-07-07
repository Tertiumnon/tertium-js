# Clean

Simple cross-platform script to remove build and distribution directories.

## What It Does

Recursively removes specified directories from the project root. Useful for cleaning up generated files before building or deploying.

## Usage

### Remove default directory (dist)
```bash
bun scripts/clean/clean.ts
node node_modules/@tertium/js/scripts/clean/clean.ts
```

### Remove specific directories
```bash
bun scripts/clean/clean.ts dist build
node node_modules/@tertium/js/scripts/clean/clean.ts dist build lib coverage
```

### Add to package.json
```json
{
  "scripts": {
    "clean": "bun scripts/clean/clean.ts",
    "clean:all": "bun scripts/clean/clean.ts dist build coverage",
    "prebuild": "bun run clean"
  }
}
```

## Behavior

- **Default target:** `dist` (if no arguments provided)
- **Skips missing directories:** Shows message but doesn't error
- **Cross-platform:** Works on Windows, macOS, and Linux
- **Recursive deletion:** Safely removes nested directories
- **Error handling:** Reports failures but continues with other targets

## Examples

```bash
# Clean just dist
bun scripts/clean/clean.ts

# Clean dist and build
bun scripts/clean/clean.ts dist build

# Clean multiple directories
bun scripts/clean/clean.ts dist build .next .parcel-cache coverage

# Via npm script
npm run clean:all
```

## Implementation Notes

- Uses `fs.rmSync` when available (Node 14.14+)
- Falls back to manual recursive removal for older Node versions
- Cross-platform compatible without external dependencies
