# Azure Deployment Pipeline

Automated production deployment via Azure Pipelines SSH.

## Overview

Replaces manual SCP-based deployments with continuous deployment triggered by version tags:

```
npm run release:patch (creates v0.3.3 tag)
         ↓
Azure Pipelines triggered on v* tag
         ↓
SSH to production server
         ↓
git pull && bun install && prisma migrate && pm2 restart
         ↓
Deployment complete ✅
```

## Quick Start

### 1. Configure Environment-Specific `.env` Files

Add deployment configuration to environment-specific `.env` files in your repository root:

**For production (.env.prod):**
```env
PROJECT_NAME=my-project
USE_PRISMA=true
AZURE_SSH_ENDPOINT=my-project-prod-ssh
DEPLOY_PATH=/var/www/my-project
```

**For staging (.env.staging):**
```env
PROJECT_NAME=my-project
USE_PRISMA=true
AZURE_SSH_ENDPOINT=my-project-staging-ssh
DEPLOY_PATH=/var/www/my-project-staging
```

**Required variables** (in `.env.{environment}`):
- `PROJECT_NAME` — project identifier used for all defaults (SSH endpoint, deploy path, PM2 app name)
- `USE_PRISMA` — true/false, whether to run Prisma migrations

**Optional variables** (auto-derived if not set):
- `AZURE_SSH_ENDPOINT` — Azure DevOps SSH service connection (default: `{PROJECT_NAME}-{environment}-ssh`)
- `DEPLOY_PATH` — absolute path on production server (default: `/var/www/{PROJECT_NAME}`)

### 2. Generate Pipeline

Run the interactive setup wizard in your repository root:

```bash
bun <path-to-script>/azure-deployment-pipeline.ts
```

The script will:
1. Ask for your project name (derived from directory name by default)
2. Ask for target environment (production, staging, development)
3. Load configuration from `.env.{environment}` file
4. Prompt for any missing values with sensible defaults
5. Generate `azure-pipelines.yml`

### 3. Azure DevOps Setup (One-time)

Create an SSH service connection with the same name from your .env file (or auto-derived from PROJECT_NAME and environment):

1. Go to: Azure DevOps Project Settings → Service connections
2. New service connection → SSH
3. Fill in:
   - Name: (e.g., `my-project-prod-ssh` — must match AZURE_SSH_ENDPOINT from .env)
   - Host: (your production server hostname or IP)
   - Port: `22`
   - Username: (deployment user)
   - Private key: (PEM-format SSH key — see below)
4. Click "Verify connection" to test
5. Save

**Generate dedicated SSH key for Azure Pipelines:**

On your local machine:
```bash
ssh-keygen -t rsa -b 4096 -m pem -f ~/.ssh/<project>-pipelines-key -N ""
cat ~/.ssh/<project>-pipelines-key  # Copy this (private key for service connection)
cat ~/.ssh/<project>-pipelines-key.pub  # Copy this (for authorized_keys on server)
```

### 4. Production Server Setup (One-time)

Convert deployment directory to a git clone:

```bash
# SSH to production server
cd <deploy-path>

# Backup existing .env if present
[ -f .env ] && mv .env .env.bak

# Clone from Azure DevOps
git clone <repo-url> .

# Restore .env
[ -f .env.bak ] && mv .env.bak .env

# Create .env if missing
cat > .env <<'EOF'
# Configure environment variables for this deployment
# Examples: DATABASE_URL, JWT_SECRET, NODE_ENV, PORT
EOF

# Add pipeline SSH public key to authorized_keys
cat >> ~/.ssh/authorized_keys <<'EOF'
<paste public key from <project>-pipelines-key.pub>
EOF

# For repo access to Azure DevOps, generate a separate key
ssh-keygen -t rsa -b 4096 -m pem -f ~/.ssh/azure-repos-key -N ""
# Add to: https://dev.azure.com/[organization]/_usersSettings/tokens
```

## Workflow

### Deploy Changes

```bash
# Make your changes
git add src/
git commit -m "feat: description of change"

# Bump version and push tag
npm run release:patch    # bumps 0.3.2 → 0.3.3 and pushes tag v0.3.3
# or
npm run release:minor    # bumps 0.3.2 → 0.4.0
npm run release:major    # bumps 0.3.2 → 1.0.0
```

The Azure Pipeline automatically triggers when the version tag is pushed.

### Monitor Deployment

Go to: Azure DevOps → Pipelines → (your project) → Builds

Check:
- Green ✅ = deployment succeeded
- Red ❌ = deployment failed (check logs for details)

### Manual Operations (if needed)

**Restart app:**
```bash
# SSH to production server
pm2 restart <app-name>
```

**Check deployment status:**
```bash
# SSH to production server
git -C <deploy-path> log --oneline -5
pm2 logs <app-name>
```

**Rollback to previous version:**
```bash
# SSH to production server
cd <deploy-path>
git reset --hard <previous-tag>  # e.g., git reset --hard v0.3.2
pm2 restart <app-name>
```

## Configuration

The setup wizard derives configuration from your project name:

- **SSH endpoint** — `<project>-<environment>-ssh`
- **Deploy path** — `/var/www/<project>`
- **App name** — `<project>`

You can customize these values during the interactive setup.

## Generated YAML

The script generates `azure-pipelines.yml` with:

- **Trigger:** Automatically on version tags (v*)
- **Pool:** Microsoft-hosted Ubuntu runner
- **Step:** SSH@0 task that connects to production server and executes deployment commands

Generated `azure-pipelines.yml` structure:

```yaml
trigger:
  tags:
    include:
      - v*

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: SSH@0
    inputs:
      sshEndpoint: '<your-ssh-endpoint>'
      runOptions: 'inline'
      inline: |
        set -e
        export PATH="$HOME/.bun/bin:$PATH"
        cd <your-deploy-path>
        git fetch origin main 2>&1
        git reset --hard origin/main 2>&1
        set -a
        [ -f .env ] && source .env 2>&1
        set +a
        bun install --production 2>&1
        # ... additional deployment commands ...
        pm2 restart <your-app-name> || pm2 start pm2.config.cjs
        pm2 save
```

**Key features:**
- All commands redirect stderr to stdout (`2>&1`) to prevent Azure's misleading `##[error]` prefixes
- Environment variables sourced from server's `.env` (never exposed in logs)
- `git reset --hard` ensures clean state (tolerates server drift)
- PM2 restart with fallback to `pm2 start` for first deployment

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "##[error]" appears in pipeline logs but status is ✅ | Normal — stderr is prefixed `##[error]`. Check actual status (green = success). |
| "bun: command not found" | Server missing bun in PATH. Pipeline includes `export PATH="$HOME/.bun/bin:$PATH"` — verify it's there. |
| "All configured authentication methods failed" | SSH key not in server's `~/.ssh/authorized_keys`. Run: `cat ~/.ssh/<server>-pipelines-key.pub >> ~/.ssh/authorized_keys` |
| SSH service connection test fails | Verify: (1) SSH endpoint name matches service connection name, (2) private key is in PEM format, (3) public key is in server's authorized_keys |
| Pipeline runs but app doesn't restart (PM2) | Check logs on server. Verify `pm2.config.cjs` exists in repo root and `appName` matches PM2 process name. |
| Prisma migration fails | Server's `.env` missing database credentials. SSH to server and verify `.env` contains valid `DATABASE_URL`. |
| Git clone/pull fails on server | Verify server can authenticate to Azure DevOps: `ssh git@ssh.dev.azure.com` (should not prompt for password). Check `~/.ssh/azure-repos-key` permissions. |

## Security

1. **SSH Keys:** Store private keys only in Azure DevOps Service Connections, never in git
2. **Credentials:** Keep in server's `.env` file, never in code or pipeline YAML
3. **Access:** Limit SSH key permissions; use `authorized_keys` restrictions if possible
4. **Rotation:** Rotate deployment keys periodically

## Files

- `azure-deployment-pipeline.ts` — Main script (generates azure-pipelines.yml)
- `azure-deployment-pipeline.types.ts` — TypeScript types
- `azure-deployment-pipeline.constants.ts` — Deployment commands and configuration
- `azure-deployment-pipeline.utils.ts` — YAML builder functions
- `azure-deployment-pipeline.test.ts` — Test suite (run with `bun test`)
- `azure-deployment-pipeline.md` — This file

## See Also

- Your repository's `docs/DEPLOY.md` — deployment procedures and setup
- Azure Pipelines documentation: https://docs.microsoft.com/azure/devops/pipelines
- SSH task documentation: https://docs.microsoft.com/azure/devops/pipelines/tasks/deploy/ssh
- Bun runtime: https://bun.sh
- PM2 process manager: https://pm2.keymetrics.io
- Prisma ORM: https://www.prisma.io
