#!/usr/bin/env bun
/**
 * Bitwarden CLI .env Importer
 * Imports environment variables from .env files into Bitwarden
 * Usage: bun import.ts <project-name> [.env-file-path]
 * Example: bun import.ts moj-grad-api moj-grad-api/.env
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

import { AVAILABLE_PROJECTS, ERROR_MESSAGES } from './bw.constants';
import { BwUtils } from './bw.utils';

const PROJECT = Bun.argv[2];
const ENV_FILE = Bun.argv[3];

if (!PROJECT) {
  console.error('Usage: bun import.ts <project-name> [.env-file-path]');
  console.error('Example: bun import.ts moj-grad-api moj-grad-api/.env');
  console.error('\nAvailable projects:');
  AVAILABLE_PROJECTS.forEach(p => console.error(`  - ${p}`));
  process.exit(1);
}

function checkBwCliInstalled() {
  try {
    execSync('bw --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkBwAuthentication() {
  try {
    const status = JSON.parse(execSync('bw status', { encoding: 'utf-8' }));
    return status.authenticated;
  } catch {
    return false;
  }
}

function loginToBitwarden() {
  console.log('Not logged into Bitwarden. Logging in...');
  try {
    execSync('bw login', { stdio: 'inherit' });
  } catch {
    throw new Error(ERROR_MESSAGES.LOGIN_FAILED);
  }
}

function unlockVault() {
  try {
    const status = JSON.parse(execSync('bw status', { encoding: 'utf-8' }));
    if (status.locked) {
      console.log('Vault is locked. Unlocking...');
      const session = execSync('bw unlock --raw', { encoding: 'utf-8' }).trim();
      process.env.BW_SESSION = session;
    }
  } catch {
    throw new Error(ERROR_MESSAGES.UNLOCK_FAILED);
  }
}

function getBwItem(itemName: string) {
  try {
    const item = JSON.parse(execSync(`bw get item "${itemName}"`, { encoding: 'utf-8' }));
    return item;
  } catch {
    return createNewBwItem(itemName);
  }
}

function createNewBwItem(itemName: string) {
  const template = {
    object: 'item',
    type: 2, // Secure Note
    name: itemName,
    login: {},
    fields: [],
    notes: `Environment variables for ${itemName}`
  };

  const tempFile = BwUtils.getTempFilePath();
  BwUtils.writeTempFile(tempFile, template);

  try {
    const output = execSync(`bw create item ${tempFile}`, { encoding: 'utf-8' });
    const result = JSON.parse(output);
    BwUtils.deleteTempFile(tempFile);
    return result;
  } catch (error) {
    BwUtils.deleteTempFile(tempFile);
    throw new Error(ERROR_MESSAGES.CREATE_FAILED);
  }
}

function updateBwItem(item: any, envVars: any) {
  BwUtils.updateItemFields(item, envVars);

  const tempFile = BwUtils.getTempFilePath();
  BwUtils.writeTempFile(tempFile, item);

  try {
    execSync(`bw edit item ${item.id} ${tempFile}`, { stdio: 'ignore' });
    BwUtils.deleteTempFile(tempFile);
    return true;
  } catch {
    BwUtils.deleteTempFile(tempFile);
    throw new Error(ERROR_MESSAGES.UPDATE_FAILED);
  }
}

function askConfirmation(message: string) {
  return new Promise<boolean>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(message + ' (y/n): ', (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

async function main() {
  try {
    BwUtils.validateProject(PROJECT);

    if (!checkBwCliInstalled()) {
      throw new Error(ERROR_MESSAGES.CLI_NOT_INSTALLED);
    }

    if (!checkBwAuthentication()) {
      loginToBitwarden();
    }

    unlockVault();

    const envFilePath = ENV_FILE || path.join(PROJECT, '.env');

    if (!fs.existsSync(envFilePath)) {
      throw new Error(`${ERROR_MESSAGES.FILE_NOT_FOUND}: ${envFilePath}`);
    }

    console.log(`\nReading .env file from: ${envFilePath}`);
    const envVars = BwUtils.parseEnvFile(envFilePath);

    if (Object.keys(envVars).length === 0) {
      throw new Error('No environment variables found in .env file');
    }

    console.log(`\nFound ${Object.keys(envVars).length} environment variables:`);
    BwUtils.formatEnvDisplay(envVars).forEach(line => console.log(line));

    let item;
    try {
      item = getBwItem(PROJECT);
      console.log(`\n✓ Found existing Bitwarden item: "${PROJECT}"`);

      const hasExistingFields = item.fields && item.fields.length > 0;
      if (hasExistingFields) {
        console.log(`  Current fields: ${item.fields.map((f: any) => f.name).join(', ')}`);
      }

      const confirmed = await askConfirmation('\n⚠ This will overwrite existing fields. Continue?');
      if (!confirmed) {
        console.log('Operation cancelled.');
        process.exit(0);
      }
    } catch {
      console.log(`\n✓ Creating new Bitwarden item: "${PROJECT}"`);
      item = getBwItem(PROJECT);
    }

    console.log('\nUpdating Bitwarden item...');
    updateBwItem(item, envVars);
    console.log(`\n✓ Successfully imported ${Object.keys(envVars).length} environment variables to Bitwarden!`);
    console.log(`\nYou can now use: npm run dev`);
    console.log('(or any other script that uses run.ts)');
  } catch (error) {
    console.error('\n✗ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
