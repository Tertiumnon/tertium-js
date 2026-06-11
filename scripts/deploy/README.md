# Deploy Command

Automated deployment tool for Node.js/Bun projects using SSH and SCP.

## Features

- **Automatic .env loading** - Reads environment variables from `.env` file automatically
- **Variable validation** - Ensures all required variables are set
- **SCP file transfer** - Copies built `dist/` directory to remote server
- **Remote dependency installation** - Runs `bun install --production` on remote
- **PM2 service management** - Restarts (or starts on first deploy) PM2 service
- **Cross-platform** - Works on Windows, macOS, and Linux with interactive shell support

## Architecture

```
deploy.ts (TypeScript)
├── Loads .env file
├── Validates environment variables
├── Executes SCP to copy dist/ files
└── Executes SSH with interactive zsh shell for bun install and pm2 restart
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
```

### As CLI Command (via @tertium/hlpr)

```bash
# Deploy with build (build then deploy)
npm run build
hlpr deploy

# Or in one command
npm run deploy
```

## Configuration

Create a `.env` file in your project root with the following variables:

```env
DEPLOY_USER=vitba                        # SSH username
DEPLOY_HOST=drh-mini                     # SSH hostname or IP
DEPLOY_PATH=/var/www/app-name            # Remote deployment directory
STATIC_SITE=true                         # Set to "true" for static sites (skips PM2)
DIST_DIR=dist/                           # Local build directory to deploy (default: dist/)
APP_NAME=app-name                        # PM2 app name (required for non-static sites)
```

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

## How It Works

1. **Load & Validate** (deploy.ts):
   - Reads and parses `.env` file from project directory
   - Validates all required environment variables (DEPLOY_USER, DEPLOY_HOST, DEPLOY_PATH, APP_NAME)

2. **Copy Files** (SCP):
   - Copies `dist/` directory to remote: `scp -r dist/ user@host:/path/`

3. **Remote Setup** (SSH with interactive zsh):
   - Uses `zsh -i -c` for proper shell environment (loads .zshrc/.bashrc)
   - Navigates to deployment directory
   - Runs `bun install --production` to install dependencies
   - Restarts PM2 process: `pm2 restart APP_NAME --update-env`
   - Falls back to `pm2 start` if process doesn't exist (first deployment)

## Requirements

- Node.js >= 14
- Bun (for building locally and on remote)
- SSH and SCP configured for remote server access
- PM2 installed on remote server: `npm install -g pm2`
- ZSH shell available on remote server
- `.env` file with required variables

## Example Deployment

```bash
# 1. Build locally
npm run build

# 2. Deploy to remote
hlpr deploy

# Output:
# Deploying to drh-mini:/var/www/app-name
# → scp -r dist/ vitba@drh-mini:/var/www/app-name/
# → ssh vitba@drh-mini "zsh -i -c 'cd /var/www/app-name && bun install --production && (pm2 restart app-name --update-env || pm2 start dist/index.js --name app-name --update-env)'"
# ✓ Deployment complete!
```

## Troubleshooting

**Command not found: bun/pm2**
- The deployment uses interactive zsh shell (`zsh -i -c`) to load environment variables
- Ensure bun and pm2 are installed on the remote server
- Check that `~/.zshrc` or `~/.bashrc` properly sets up the PATH

**PM2 process not found**
- On first deployment, the script starts the service instead of restarting
- Subsequent deployments will restart the running process

**SCP permission denied**
- Ensure SSH key is configured and you have write permissions to DEPLOY_PATH
- Test with: `ssh user@host "ls -la /path"`
