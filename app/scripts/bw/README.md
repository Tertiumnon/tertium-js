# Bitwarden CLI Scripts - Module Structure

## Directory Layout

```
tertium-js/app/scripts/bw/
├── bw.types.ts       # TypeScript interfaces
├── bw.constants.ts   # Configuration & constants
├── bw.utils.ts       # Utility class
├── bw.service.ts     # Main BitwaidenService class
├── index.ts          # Module exports
├── run.ts            # TypeScript wrapper script
├── import.ts         # TypeScript importer script
└── README.md         # This file
```

## File Descriptions

### bw.types.ts
Defines all TypeScript interfaces for type safety:
- `BwSecret` - Secret configuration (env name + Bitwarden field name)
- `BwItem` - Bitwarden vault item structure
- `BwField` - Custom field in vault item
- `BwStatus` - Authentication/lock status
- `EnvVars` - Map of environment variables
- `ProjectConfig` - Project → secrets mapping

### bw.constants.ts
Centralized configuration:
- `PROJECT_SECRETS` - Maps each project to its required secrets
- `AVAILABLE_PROJECTS` - List of valid project names
- `BW_TEMP_DIR` - Temporary directory for JSON files
- `ERROR_MESSAGES` - Standardized error text

**Extending Projects:**
To add a new project, add entry to `PROJECT_SECRETS`:
```typescript
export const PROJECT_SECRETS = {
  'existing-project': [...],
  '{project}': [
    { env: 'API_URL', name: 'API_URL' },
    { env: 'SECRET_KEY', name: 'SECRET_KEY' }
  ]
};
```

### bw.utils.ts
Static utility class (`BwUtils`) with helper methods:
- **File Operations**: `parseEnvFile()`, `writeTempFile()`, `deleteTempFile()`
- **Field Management**: `updateItemFields()`, `createBwField()`, `ensureFieldsArray()`
- **Validation**: `validateProject()`, `getProjectSecrets()`
- **Display**: `formatEnvDisplay()` - Pretty-print environment variables
- **Parsing**: `parseJsonSafely()`, `executeCommand()`

**Example Usage:**
```typescript
const envVars = BwUtils.parseEnvFile('.env');
BwUtils.validateProject('{project}');
const secrets = BwUtils.getProjectSecrets('{project}');
```

### bw.service.ts
Main service class (`BitwaidenService`) for Bitwarden interactions:

**Constructor:**
```typescript
const bw = new BitwaidenService('{project}');
```

**Methods:**
- `checkCliInstalled(): boolean` - Verify bw CLI is available
- `checkAuthentication(): boolean` - Check if logged in
- `login(): void` - Prompt login if needed
- `unlockVault(): void` - Unlock vault with BW_SESSION
- `getSecret(name, itemName): string` - Get single secret
- `loadSecrets(): void` - Load all project secrets to process.env
- `getLoadedSecrets(): Record<string, string>` - Get loaded secrets
- `executeCommand(command): void` - Execute with loaded secrets

**Workflow:**
```typescript
const bw = new BitwaidenService('{project}');
try {
  bw.loadSecrets();  // Handles login, unlock, secret retrieval
  bw.executeCommand('npm run dev');  // Executes with env vars
} catch (error) {
  console.error(error.message);
}
```

### index.ts
Named exports for the module:
```typescript
export { BitwaidenService } from './bw.service';
export type { BwItem, BwSecret, BwStatus, EnvVars, BwField } from './bw.types';
export { BwUtils } from './bw.utils';
export { PROJECT_SECRETS, AVAILABLE_PROJECTS, ERROR_MESSAGES } from './bw.constants';
```

**Importing in other files:**
```typescript
// Import service and utilities
import { BitwaidenService, BwUtils } from '@tertium/js/scripts/bw';

// Import types
import type { EnvVars, BwItem } from '@tertium/js/scripts/bw';

// Import constants
import { AVAILABLE_PROJECTS } from '@tertium/js/scripts/bw';
```

### run.ts
TypeScript wrapper script using Bun for loading secrets and executing commands.

**Usage:**
```bash
bun ./node_modules/@tertium/js/app/scripts/bw/run.ts {project} "COMMAND"
```

**In package.json:**
```json
{
  "scripts": {
    "dev": "bun ./node_modules/@tertium/js/app/scripts/bw/run.ts {project} \"bun run --watch src\"",
    "dev:local": "bun run --watch src"
  }
}
```

**Features:**
- Validates project name
- Checks CLI installation
- Handles login if needed
- Unlocks vault
- Loads all secrets for project
- Executes command with secrets in environment
- Cross-platform shell support (cmd.exe / bash)

### import.ts
TypeScript script for importing .env files to Bitwarden vault.

**Usage:**
```bash
bun ./node_modules/@tertium/js/app/scripts/bw/import.ts {project} [.env-path]
```

**Workflow:**
1. Validates project name
2. Checks Bitwarden CLI
3. Handles authentication
4. Parses .env file
5. Creates or gets existing Bitwarden item
6. Prompts for confirmation if item exists
7. Updates vault item with environment variables

**Features:**
- Parses .env with comment/quote handling
- Creates Secure Note if item doesn't exist
- Updates custom fields (not notes)
- Interactive confirmation
- Cleanup of temporary JSON files
- Error handling and rollback

## Integration Pattern

### Standard Project Setup
1. Install @tertium/js as dependency: `npm install @tertium/js`
2. Add to `bw.constants.ts`:
   ```typescript
   export const PROJECT_SECRETS = {
     '{project}': [
       { env: 'DATABASE_URL', name: 'DATABASE_URL' },
       { env: 'PORT', name: 'PORT' }
     ]
   };
   ```
3. Add dual npm scripts in package.json:
   ```json
   {
     "scripts": {
       "dev": "bun ./node_modules/@tertium/js/app/scripts/bw/run.ts {project} \"bun run --watch src\"",
       "dev:local": "bun run --watch src"
     }
   }
   ```
4. Import secrets to Bitwarden:
   ```bash
   bun ./node_modules/@tertium/js/app/scripts/bw/import.ts {project} .env
   ```
5. Run with secrets:
   ```bash
   npm run dev
   ```

### Advanced Usage
Import service in custom scripts:
```typescript
import { BitwaidenService } from '@tertium/js/scripts/bw';

async function deployWithSecrets() {
  const bw = new BitwaidenService('{project}');
  bw.loadSecrets();

  // process.env now contains all secrets
  const apiUrl = process.env.API_URL;
  // Use secrets for deployment
}
```

## Error Handling

All methods throw descriptive errors:
- `CLI_NOT_INSTALLED` - Bitwarden CLI not in PATH
- `LOGIN_FAILED` - Authentication failed
- `UNLOCK_FAILED` - Vault unlock failed
- `CREATE_FAILED` - Failed to create vault item
- `UPDATE_FAILED` - Failed to update vault item
- `FILE_NOT_FOUND` - .env file not found
- `INVALID_PROJECT` - Unknown project name

Example error handling:
```typescript
try {
  const bw = new BitwaidenService(projectName);
  bw.loadSecrets();
} catch (error) {
  if (error.message.includes('CLI_NOT_INSTALLED')) {
    console.error('Please install: https://bitwarden.com/download/');
  } else if (error.message.includes('INVALID_PROJECT')) {
    console.error(`Available projects: ${AVAILABLE_PROJECTS.join(', ')}`);
  }
  process.exit(1);
}
```

## Configuration

### Adding New Projects
Edit `bw.constants.ts`:
```typescript
export const PROJECT_SECRETS = {
  'existing-project': [...],
  '{project}': [
    { env: 'DB_HOST', name: 'DB_HOST' },
    { env: 'DB_PORT', name: 'DB_PORT' },
    { env: 'API_KEY', name: 'API_KEY' }
  ]
};
```

### Custom Bitwarden Item Names
By default, item name = project name. To use different item name, modify `run.ts`:
```typescript
// In run.ts
const value = bw.getSecret(name, 'custom-vault-item-name');
```

### Field Type Mapping
Currently uses custom fields (type 0 = text). To use different field types, modify `BwUtils.createBwField()`:
```typescript
static createBwField(name: string, value: string, type = 0): BwField {
  return { type, name, value };  // type: 0=text, 1=hidden, 2=boolean
}
```

## Testing

### Test Single Secret
```bash
bun run.ts {project} "echo $DATABASE_URL"
```

### Test Import
```bash
bun import.ts {project} .env
```

### Verify Vault Item
```bash
bw list items --search {project}
bw get item {project} | jq '.fields'
```
