# Deploy Service

Centralized deployment service for managing application deployments to remote servers via SSH.

## Features

- **Build locally** - Configurable build commands (bun, npm, etc.)
- **Copy to server** - Securely copy built files and dependencies via SCP
- **Update dependencies** - Install production dependencies on remote server
- **Restart processes** - Gracefully restart applications using PM2
- **Verify deployment** - Check deployment status via PM2

## Configuration

Create a `deploy.config.ts` file in your project root:

```typescript
import type { DeployConfig } from "@tertium/js/app/scripts/deploy";

export default {
  remoteHost: "tertium",
  deployPath: "/var/www/my-app",
  appName: "my-app",
  localDist: "./dist",
  tempPath: "/tmp/my-app-deploy",
  buildCommand: "bun run build", // Optional, defaults to "bun run build"
  envFile: ".env",               // Optional
  serverFile: "server.js",       // Optional
  port: 3000                     // Optional
} satisfies DeployConfig;
```

## Usage

### Deploy with build

```bash
bun ./node_modules/@tertium/js/app/scripts/deploy/run.ts ./deploy.config.ts
```

### Deploy without build

```bash
bun ./node_modules/@tertium/js/app/scripts/deploy/run.ts ./deploy.config.ts --skip-build
```

### Using in npm scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "deploy": "bun ./node_modules/@tertium/js/app/scripts/deploy/run.ts ./deploy.config.ts",
    "deploy:skip-build": "bun ./node_modules/@tertium/js/app/scripts/deploy/run.ts ./deploy.config.ts --skip-build"
  }
}
```

## Configuration Options

### Required

| Option | Type | Description |
|--------|------|-------------|
| `remoteHost` | string | SSH hostname (e.g., "tertium") |
| `deployPath` | string | Destination path on remote server |
| `appName` | string | Application name for PM2 |
| `localDist` | string | Local build directory path |
| `tempPath` | string | Temporary path on remote server |

### Optional

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sshHost` | string | `remoteHost` | SSH hostname override |
| `buildCommand` | string | "bun run build" | Build command to execute |
| `envFile` | string | undefined | Path to .env file to copy |
| `serverFile` | string | undefined | Server entry file (e.g., server.js) |
| `port` | number | undefined | PORT environment variable for PM2 |
| `skipDotfiles` | boolean | false | Skip dotfiles during copy |

## Deployment Flow

1. **Build** - Executes build command (unless `--skip-build` is set)
2. **Copy** - Uploads dist and config files to temporary location
3. **Dependencies** - Installs production dependencies on remote
4. **Restart** - Restarts PM2 process with new code
5. **Verify** - Confirms deployment status

## Environment Setup

Ensure the following:

- SSH key-based authentication configured for remote host
- `deploy` user exists on remote server with PM2 access
- PM2 is installed and configured on remote server
- `sudo` permission for deployment user without password prompt

## Programmatic Usage

```typescript
import { createDeployService } from "@tertium/js/app/scripts/deploy";

const config = {
  remoteHost: "tertium",
  deployPath: "/var/www/my-app",
  appName: "my-app",
  localDist: "./dist",
  tempPath: "/tmp/my-app-deploy"
};

const deployer = await createDeployService(config);
const result = await deployer.deploy();

if (result.success) {
  console.log("✓ Deployed successfully");
} else {
  console.error("✗ Deployment failed:", result.message);
}
```

## Error Handling

All errors are logged with timestamps. Common issues:

- **Build failed** - Check buildCommand and ensure dependencies are installed
- **SSH connection** - Verify SSH key setup and remote hostname
- **Permissions** - Ensure deploy user has write access to deployPath
- **PM2** - Confirm PM2 is installed on remote server

## Logs

All operations are timestamped and logged to stdout:

```
[2025-02-23T10:30:45.123Z] Starting deployment process...
[2025-02-23T10:30:45.456Z] Building application locally...
[2025-02-23T10:30:48.789Z] ✓ Build successful
[2025-02-23T10:30:48.901Z] Copying built files to remote server...
```
