#!/usr/bin/env bun
/**
 * NPM Script wrapper for Bitwarden CLI
 * Loads environment variables from Bitwarden and executes the provided command
 * Usage: bun run.ts PROJECT_NAME COMMAND
 * Example: bun run.ts moj-grad-api "bun run --watch src/index.ts"
 */

import { BitwaidenService } from './bw.service';

const PROJECT = Bun.argv[2];
const COMMAND = Bun.argv.slice(3).join(' ');

if (!PROJECT || !COMMAND) {
  console.error('Usage: bun run.ts PROJECT_NAME COMMAND');
  console.error('Example: bun run.ts moj-grad-api "bun run --watch src/index.ts"');
  process.exit(1);
}

try {
  const bw = new BitwaidenService(PROJECT);
  bw.loadSecrets();
  bw.executeCommand(COMMAND);
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
