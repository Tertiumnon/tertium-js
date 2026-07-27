# Deploy Command

Automated deployment tool for Node.js/Bun projects using SSH and SCP.

## Features

- **Automatic .env loading** - Reads environment variables from `.env` file automatically
- **Variable validation** - Ensures all required variables are set, and that `DEPLOY_PATH` is a safe absolute path
- **Builds locally** - Runs `BUILD_COMMAND` (default `bun run build`) before deploying, unless `--skip-build` is passed
- **Clean remote deploy** - Removes everything under `DEPLOY_PATH` except `.env` before copying, so stale files (old `package.json`, mismatched lockfiles, old builds) can never linger between deployments
- **SCP file transfer** - Copies `package.json`, a lockfile, and the whole `dist/` directory (preserving the folder, not flattening it) to the remote server
- **Remote dependency installation** - Runs `bun install --production` on remote
- **PM2 service management, always on Bun** - Every deploy does `pm2 delete` + `pm2 start ... --interpreter bun`, so the app can never end up running under Node from a stale or manually-created PM2 process
- **Cross-platform** - Works on Windows, macOS, and Linux with interactive shell support

## Architecture

```
deploy.ts (TypeScript)
├── Loads .env file
├── Validates environment variables (including DEPLOY_PATH safety)
├── Builds locally (BUILD_COMMAND, skippable with --skip-build)
├── Cleans DEPLOY_PATH on remote, preserving .env
├── Copies package.json + lockfile + dist/ (as a folder) via SCP
└── Executes SSH with interactive zsh shell: bun install, pm2 delete+start --interpreter bun, pm2 save
```

## Usage

### As Library (from @tertium/js)

```typescript
import { deploy } from '@tertium/js/scripts/deploy';

// Deploy with default config (uses process.cwd() and reads .env)
deploy();

// Or with custom config
deploy({
  projectDir: '/path/to/project',
  env: {
    DEPLOY_USER: 'vitba',
    DEPLOY_HOST: 'drh-mini',
    DEPLOY_PATH: '/var/www/app-name',
    APP_NAME: 'app-name'
  }
});

// Deploy using a specific env file (.env.dev, .env.prod, etc.)
deploy({
  projectDir: '/path/to/project',
  envFile: '.env.prod'
});
```

### As CLI Command

```bash
# Deploy with default .env config
bun scripts/deploy/deploy.ts

# Deploy using a specific environment config file
bun scripts/deploy/deploy.ts --env-file=.env.dev
bun scripts/deploy/deploy.ts --env-file=.env.prod

# Skip build (if already built)
bun scripts/deploy/deploy.ts --skip-build
```

Or add npm/bun scripts to `package.json` for convenience:

```json
{
  "scripts": {
    "deploy": "bun scripts/deploy/deploy.ts",
    "deploy:dev": "bun scripts/deploy/deploy.ts --env-file=.env.dev",
    "deploy:prod": "bun scripts/deploy/deploy.ts --env-file=.env.prod"
  }
}
```

Then run:
```bash
bun run deploy
bun run deploy:dev
bun run deploy:prod
```

## Configuration

### Multiple Environment Configs

Create `.env` files for different deployment environments. The deploy tool supports multiple config files:

- `.env` (default)
- `.env.dev` (development deployment)
- `.env.prod` (production deployment)
- `.env.staging` (staging deployment)
- Any custom `.env.*` file

Specify which config file to use via the `envFile` option:

```typescript
// Programmatically
deploy({ envFile: '.env.dev' });

// Via CLI
hlpr deploy --env-file=.env.prod
```

If a specified env file is not found, the tool will list available configs and suggest which to use.

### Configuration Variables

Create a `.env` (or `.env.dev`, `.env.prod`, etc.) file in your project root with the following variables:

```env
DEPLOY_USER=vitba                        # SSH username (must own DEPLOY_PATH, or be able to mkdir it)
DEPLOY_HOST=drh-mini                     # SSH hostname or IP
DEPLOY_PATH=/var/www/app-name            # Remote deployment directory (absolute path, not "/")
STATIC_SITE=true                         # Set to "true" for static sites (skips bun install and PM2)
DIST_DIR=dist                            # Local build directory to deploy (default: dist)
APP_NAME=app-name                        # PM2 app name (required for non-static sites)
BUILD_COMMAND=bun run build              # Optional, defaults to "bun run build"
SERVER_FILE=server.js                    # Optional, overrides the default "${DIST_DIR}/index.js" entry point
PORT=3000                                # Optional, passed to PM2 as the PORT env var
```

> Note: for non-static deployments, `DEPLOY_USER` connects directly over SSH — no `sudo`, no intermediate user. Set up a dedicated SSH key for this user (see Troubleshooting) rather than sharing your personal login.

### Static Site Deployment (Angular, React, Vue, etc.)

For static sites, set `STATIC_SITE=true` and optionally specify `DIST_DIR` to point to your build output:

```env
DEPLOY_USER=myuser
DEPLOY_HOST=myserver
DEPLOY_PATH=/var/www/my-site
STATIC_SITE=true
DIST_DIR=dist/my-app/browser/          # Angular example
# APP_NAME not needed for static sites
```

## Remote `.env` (app secrets)

`deploy.ts` reads a **local** `.env` to know *how* to deploy (`DEPLOY_USER`, `DEPLOY_HOST`, `DEPLOY_PATH`, ...). It never uploads that file. Your app's runtime secrets on the server live in a **separate, independent** `.env` that you manage directly on the remote host — the two files are not related and can hold entirely different values.

- **It's a one-time manual bootstrap.** On a brand-new `DEPLOY_PATH`, create `.env` there yourself (`scp` it up once, or write it directly) before the first deploy. `deploy.ts` will happily start the app without it, just with empty secrets.
- **It must live at `DEPLOY_PATH/.env`** — a sibling of `dist/`, not inside it. PM2 starts the app with `cwd` set to `DEPLOY_PATH`, and both Bun's built-in `.env` auto-loading and the common `import "dotenv/config"` pattern resolve `.env` relative to `process.cwd()`, not relative to the script file. Putting it inside `dist/` silently breaks secret loading.
- **The clean-remote step preserves it deliberately.** Every deploy wipes everything under `DEPLOY_PATH` except `.env` (see "Clean Remote" below) — that's what makes the bootstrap genuinely one-time instead of something you redo on every deploy.

## How It Works

1. **Load & Validate** (deploy.ts):
   - Reads and parses `.env` file from project directory
   - Validates all required environment variables (DEPLOY_USER, DEPLOY_HOST, DEPLOY_PATH, APP_NAME)
   - Rejects an unsafe `DEPLOY_PATH` (must be absolute, must not be `/`)

2. **Build** (unless `--skip-build`):
   - Runs `BUILD_COMMAND` (default `bun run build`) locally

3. **Clean Remote** (SSH):
   - `mkdir -p` DEPLOY_PATH, then deletes everything directly under it except `.env`
   - Guarantees no file from a previous deploy (old `package.json`, old lockfile, orphaned build output) can leak into the new one

4. **Copy Files** (SCP):
   - App deployments: copies `package.json`, a lockfile (`bun.lockb` / `bun.lock` / `package-lock.json`, first one found), and the `dist/` directory itself — so it lands as `DEPLOY_PATH/dist/...`, matching PM2's entry point
   - Static sites (`STATIC_SITE=true`): copies the *contents* of `DIST_DIR` directly into `DEPLOY_PATH`, since static assets are served from there directly

5. **Remote Setup** (SSH with interactive zsh):
   - Uses `zsh -i -c` for proper shell environment (loads .zshrc/.bashrc)
   - Runs `bun install --production`
   - Generates Prisma client if `${DIST_DIR}/src/db/schema.prisma` exists
   - `pm2 delete APP_NAME` (ignored if it doesn't exist) then `pm2 start ${DIST_DIR}/index.js --name APP_NAME --interpreter bun` — always recreated fresh, so PM2 can never be left running the app under Node
   - `pm2 save` to persist across reboots

## Requirements

- Node.js >= 14
- Bun (for building locally and on remote)
- SSH and SCP configured for remote server access
- PM2 installed on remote server: `npm install -g pm2`
- ZSH shell available on remote server
- `.env` file with required variables

## Example Deployments

### Default deployment (reads .env)
```bash
bun scripts/deploy/deploy.ts
```

### Development deployment (reads .env.dev)
```bash
bun scripts/deploy/deploy.ts --env-file=.env.dev

# Output:
# [2024-01-15T10:30:45.123Z] Loaded config from .env.dev
# Deploying to dev-server:/var/www/app-name-dev
# → bun run build
# → ssh deploy@dev-server "mkdir -p '/var/www/app-name-dev' && cd '/var/www/app-name-dev' && find . -mindepth 1 -maxdepth 1 ! -name '.env' -exec rm -rf {} +"
# → scp -r dist package.json bun.lockb deploy@dev-server:/var/www/app-name-dev/
# → ssh deploy@dev-server "zsh -i -c 'cd '/var/www/app-name-dev' && bun install --production && ... && pm2 delete app-name-dev >/dev/null 2>&1 || true && pm2 start dist/index.js --name app-name-dev --interpreter bun --update-env && pm2 save'"
# ✓ Deployment complete!
```

### Production deployment (reads .env.prod)
```bash
bun scripts/deploy/deploy.ts --env-file=.env.prod
```

Building is now part of `deploy()` itself (via `BUILD_COMMAND`); pass `--skip-build` on the CLI if you've already built and just want to redeploy.

## Troubleshooting

**Config file not found**
- The tool will list all available `.env*` files if the requested one doesn't exist
- Create the appropriate config file (`.env`, `.env.dev`, `.env.prod`, etc.) in your project root
- Ensure the file path is correct when using `--env-file=` flag

**Command not found: bun/pm2**
- The deployment uses interactive zsh shell (`zsh -i -c`) to load environment variables
- Ensure bun and pm2 are installed on the remote server
- Check that `~/.zshrc` or `~/.bashrc` properly sets up the PATH

**PM2 process not found**
- Every deployment deletes and recreates the PM2 process (with `--interpreter bun`), so this is expected on first deploy and harmless on every deploy after

**SCP permission denied / password prompt**
- Ensure DEPLOY_USER has a dedicated SSH key trusted in its `~/.ssh/authorized_keys` on the remote host — don't reuse a personal login's key, and don't rely on password auth
- Generate one: `ssh-keygen -t ed25519 -f ~/.ssh/<name> -C "<deploy-user>@<host>" -N ""`, append the `.pub` to the remote user's `authorized_keys`, then add a matching `Host` entry to your local `~/.ssh/config` (or an extra `IdentityFile` line on an existing entry for that host)
- Test with: `ssh -o BatchMode=yes user@host whoami` — it must succeed with no prompt
- Ensure DEPLOY_USER has write permissions to DEPLOY_PATH (or can `mkdir -p` it)
