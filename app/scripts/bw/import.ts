#!/usr/bin/env bun
/**
 * Bitwarden CLI .env Importer
 * Imports environment variables from .env files into Bitwarden
 * Usage: bun import.ts <project-name> [.env-file-path]
 * Example: bun import.ts moj-grad-api
 * Example: bun import.ts moj-grad-api .env
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { AVAILABLE_PROJECTS, ERROR_MESSAGES } from './bw.constants';
import { BwUtils } from './bw.utils';

const PROJECT = Bun.argv[2];
const ENV_FILE = Bun.argv[3] || '.env';

if (!PROJECT) {
  console.error('Usage: bun import.ts <project-name> [.env-file-path]');
  console.error('Example: bun import.ts moj-grad-api');
  console.error('Example: bun import.ts moj-grad-api .env');
  console.error('\nAvailable projects:');
  AVAILABLE_PROJECTS.forEach(p => console.error(`  - ${p}`));
  process.exit(1);
}

function parseEnvFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};

  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const [key, ...valueParts] = line.split('=');
    if (key) env[key.trim()] = valueParts.join('=').trim();
  });

  return env;
}

function createBwItem(projectName: string, envVars: Record<string, string>) {
  const fields = Object.entries(envVars).map(([name, value]) => ({
    type: 0,
    name,
    value
  }));

  const item = {
    passwordHistory: [],
    revisionDate: null,
    creationDate: null,
    deletedDate: null,
    archivedDate: null,
    organizationId: null,
    collectionIds: null,
    folderId: null,
    type: 1,
    name: projectName,
    notes: `Environment variables for ${projectName}`,
    favorite: false,
    fields,
    login: null,
    secureNote: null,
    card: null,
    identity: null,
    sshKey: null,
    reprompt: 0
  };

  const json = JSON.stringify(item);
  const encoded = Buffer.from(json).toString('base64');

  try {
    const result = execSync(`bw create item "${encoded}"`, { encoding: 'utf-8' });
    return JSON.parse(result);
  } catch (error) {
    throw new Error(`Failed to create Bitwarden item: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function updateBwItem(projectName: string, envVars: Record<string, string>) {
  const item = {
    passwordHistory: [],
    revisionDate: null,
    creationDate: null,
    deletedDate: null,
    archivedDate: null,
    organizationId: null,
    collectionIds: null,
    folderId: null,
    type: 1,
    name: projectName,
    notes: `Environment variables for ${projectName}`,
    favorite: false,
    fields: Object.entries(envVars).map(([name, value]) => ({
      type: 0,
      name,
      value
    })),
    login: null,
    secureNote: null,
    card: null,
    identity: null,
    sshKey: null,
    reprompt: 0
  };

  const json = JSON.stringify(item);
  const encoded = Buffer.from(json).toString('base64');

  try {
    execSync(`bw edit item "${projectName}" "${encoded}"`, { encoding: 'utf-8' });
  } catch (error) {
    throw new Error(`Failed to update item: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  try {
    BwUtils.validateProject(PROJECT);

    try {
      execSync('bw --version', { stdio: 'ignore' });
    } catch {
      throw new Error(ERROR_MESSAGES.CLI_NOT_INSTALLED);
    }

    try {
      const status = JSON.parse(execSync('bw status', { encoding: 'utf-8' }));
      if (!status.authenticated) {
        throw new Error('Not authenticated with Bitwarden. Run: bw login');
      }
      if (status.locked) {
        throw new Error('Vault is locked. Run: bw unlock');
      }
    } catch {
      throw new Error('Vault authentication failed');
    }

    const envFilePath = path.isAbsolute(ENV_FILE) ? ENV_FILE : path.join(process.cwd(), ENV_FILE);

    if (!fs.existsSync(envFilePath)) {
      throw new Error(`${ERROR_MESSAGES.FILE_NOT_FOUND}: ${envFilePath}`);
    }

    console.log(`Reading .env file from: ${envFilePath}`);
    const envVars = parseEnvFile(envFilePath);

    if (Object.keys(envVars).length === 0) {
      throw new Error('No environment variables found in .env file');
    }

    console.log(`\nFound ${Object.keys(envVars).length} environment variables:`);
    Object.entries(envVars).forEach(([key, value]) => {
      const maskedValue = value.length > 20 ? value.substring(0, 20) + '...' : value;
      console.log(`  - ${key} = ${maskedValue}`);
    });

    let existingItem = null;
    try {
      const result = execSync(`bw get item "${PROJECT}"`, { encoding: 'utf-8' });
      existingItem = JSON.parse(result);
    } catch {
      // Item doesn't exist, which is fine
    }

    if (existingItem) {
      console.log(`\n⚠ Bitwarden item "${PROJECT}" already exists.`);
      console.log(`  Overwriting with ${Object.keys(envVars).length} new variables...\n`);

      updateBwItem(PROJECT, envVars);
      console.log(`✓ Updated Bitwarden item: "${PROJECT}"`);
    } else {
      console.log(`\nCreating new Bitwarden item for "${PROJECT}"...\n`);
      const created = createBwItem(PROJECT, envVars);
      console.log(`✓ Created Bitwarden item: "${created.name}" (ID: ${created.id})`);
    }

    console.log(`\n✓ Successfully imported ${Object.keys(envVars).length} environment variables!`);
    console.log('\nYou can now use:');
    console.log(`  bun ./node_modules/@tertium/js/app/scripts/bw/run.ts ${PROJECT} "your command"`);
  } catch (error) {
    console.error('\n✗ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
