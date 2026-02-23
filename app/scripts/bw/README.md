# Bitwarden CLI Integration

Secure environment variable management using Bitwarden vault. Load secrets from Bitwarden and inject them into your commands.

## Quick Start

### 1. Store secrets in Bitwarden

\\\ash
# Create or update project secrets in vault
bun ./node_modules/@tertium/js/app/scripts/bw/import.ts {project}
\\\

### 2. Run commands with secrets

\\\ash
# Execute command with secrets from vault
bun ./node_modules/@tertium/js/app/scripts/bw/run.ts {project} "your command"

# Examples:
bun ./node_modules/@tertium/js/app/scripts/bw/run.ts moj-grad-api "bun run dev"
bun ./node_modules/@tertium/js/app/scripts/bw/run.ts weather-api "npm start"
\\\

## Usage in package.json

\\\json
{
  "scripts": {
    "dev": "bun ./node_modules/@tertium/js/app/scripts/bw/run.ts {project} \"your command\"",
    "import": "bun ./node_modules/@tertium/js/app/scripts/bw/import.ts {project}"
  }
}
\\\

## Scripts

### \
un.ts\
Loads secrets from Bitwarden and executes a command with them as environment variables.

\\\ash
bun run.ts <project> "<command>"
\\\

**What it does:**
1. Checks if Bitwarden vault is unlocked
2. Retrieves secrets for the project from vault
3. Injects secrets into process.env
4. Executes the command with those variables

### \import.ts\
Imports environment variables from \.env\ file into Bitwarden vault.

\\\ash
bun import.ts <project> [.env-path]
\\\

**What it does:**
1. Reads \.env\ file
2. Parses all variables
3. Creates or updates Bitwarden item
4. Stores variables as custom fields

## Setup

### Prerequisites

- Bitwarden CLI installed: \w --version\
- Logged in: \w login\
- Vault unlocked: \w unlock\ (sets \BW_SESSION\ env var)

### First Time Setup

1. **Prepare your \.env\ file** with all variables
2. **Import to Bitwarden**:
   \\\ash
   bun import.ts {project}
   \\\
3. **Verify in vault** - Item should have all variables as fields
4. **Use run.ts** to load secrets into commands

## Supported Projects

- \moj-grad-api\
- \moj-grad-web\
- \moj-grad-app\
- \weather-api\
- \origin-creative-studio.www\

To add a new project, update \w.constants.ts\ with PROJECT_SECRETS mapping.

## Troubleshooting

**Error: "Vault is locked"**
\\\ash
bw unlock
\\\

**Error: "Not authenticated"**
\\\ash
bw login
\\\

**Error: "Project not found"**
Check supported projects list and run import.ts first.

## Files

- \w.types.ts\ - TypeScript interfaces
- \w.constants.ts\ - Project configuration
- \w.utils.ts\ - Helper utilities
- \w.service.ts\ - Core Bitwarden service
- \
un.ts\ - CLI wrapper script
- \import.ts\ - Import .env to vault
- \index.ts\ - Module exports
