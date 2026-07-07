# Improve Start Scripts

Automatically detects project type and ensures `start` and `dev` npm scripts are configured appropriately.

## What It Does

This script:
1. **Detects** the project framework by analyzing dependencies
2. **Checks** whether `start` and `dev` scripts exist
3. **Suggests** appropriate commands based on the detected framework
4. **Updates** package.json with the suggested scripts (when `--update` is used)

## Supported Frameworks

| Framework | Detection | Dev Script | Start Script |
|-----------|-----------|-----------|--------------|
| **SolidJS + Vite** | `solid-js` + `vite-plugin-solid` | `vite` | `vite preview` |
| **React + Vite** | `react` + `vite` | `vite` | `vite preview` |
| **Vue + Vite** | `vue` + `vite` | `vite` | `vite preview` |
| **Generic Vite** | `vite` only | `vite` | `vite preview` |
| **Angular** | `@angular/core` | `ng serve` | `ng serve` |
| **Create React App** | `react-scripts` | `react-scripts start` | `react-scripts start` |

## Usage

### Check Current Project
```bash
bun scripts/improve-start-scripts/improve-start-scripts.ts
```

### Check Specific Project
```bash
bun scripts/improve-start-scripts/improve-start-scripts.ts /path/to/project
```

### Update Scripts
```bash
bun scripts/improve-start-scripts/improve-start-scripts.ts --update
```

### Force Update (overwrite existing scripts)
```bash
bun scripts/improve-start-scripts/improve-start-scripts.ts --force
bun scripts/improve-start-scripts/improve-start-scripts.ts /path/to/project --force
```

### Show Help
```bash
bun scripts/improve-start-scripts/improve-start-scripts.ts --help
```

## Adding to Your Project

Add to your project's `package.json`:

```json
{
  "scripts": {
    "improve:scripts": "bun node_modules/@tertium/js/scripts/improve-start-scripts/improve-start-scripts.ts"
  }
}
```

Then use:
```bash
bun run improve:scripts
bun run improve:scripts -- /path/to/other/project --update
```

## Example Output

### Check without updating
```
📦 Project: /path/to/project
🔍 Framework: SolidJS with Vite
✓ Scripts: start | ⚠️  missing dev

💡 To update scripts, run with --update flag
   Suggested start: "vite preview"
   Suggested dev: "vite"
```

### Update scripts
```
📦 Project: /path/to/project
🔍 Framework: SolidJS with Vite
✓ Scripts: start | ⚠️  missing dev
✏️  Added "dev" → "vite"
✅ package.json updated
```

### Already configured
```
📦 Project: /path/to/project
🔍 Framework: SolidJS with Vite
✓ Scripts: start | dev
✅ Scripts already configured
```

## Script Behavior

### Dev vs Start Scripts

- **`dev`**: Runs the development server with hot module reloading (HMR)
  - Best for active development
  - Watches for file changes automatically

- **`start`**: Runs a production preview of the built application
  - Simulates production-like environment
  - Serves the built output, not source files

### Framework Detection Order

Detection follows this priority:
1. Check for framework-specific dependencies
2. If Vite is present, use Vite variant
3. Fall back to "unknown" (defaults to `node .`)

### What the Script Does NOT Do

- Does not install missing dependencies
- Does not modify other npm scripts
- Does not handle monorepos (run on each package individually)
- Does not validate that scripts actually work (only suggests based on dependencies)

## Integration with CI/CD

You can integrate this into your setup/build process:

```bash
# Batch check multiple projects
for project in ./apps/*; do
  bun node_modules/@tertium/js/scripts/improve-start-scripts/improve-start-scripts.ts "$project" --update
done
```

Or in a GitHub Actions workflow:
```yaml
- name: Improve npm scripts
  run: bun node_modules/@tertium/js/scripts/improve-start-scripts/improve-start-scripts.ts --update
```
