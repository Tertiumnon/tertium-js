import { execSync } from 'child_process';
import { spawn } from 'child_process';

import type { BwItem, BwStatus, EnvVars } from './bw.types.js';
import { PROJECT_SECRETS, ERROR_MESSAGES, AVAILABLE_PROJECTS } from './bw.constants.js';
import { BwUtils } from './bw.utils.js';

export class BitwaidenService {
  private project: string;
  private secrets: Map<string, string> = new Map();

  constructor(project: string) {
    BwUtils.validateProject(project);
    this.project = project;
  }

  checkCliInstalled(): boolean {
    try {
      execSync('bw --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  checkAuthentication(): boolean {
    try {
      const status = JSON.parse(execSync('bw status', { encoding: 'utf-8' })) as BwStatus;
      return status.authenticated;
    } catch {
      return false;
    }
  }

  login(): void {
    console.log('Not logged into Bitwarden. Please login...');
    try {
      execSync('bw login', { stdio: 'inherit' });
    } catch {
      throw new Error(ERROR_MESSAGES.LOGIN_FAILED);
    }
  }

  unlockVault(): void {
    try {
      const status = JSON.parse(execSync('bw status', { encoding: 'utf-8' })) as BwStatus;
      if (status.locked) {
        console.log('Vault is locked. Unlocking...');
        const session = execSync('bw unlock --raw', { encoding: 'utf-8' }).trim();
        process.env.BW_SESSION = session;
      }
    } catch {
      throw new Error(ERROR_MESSAGES.UNLOCK_FAILED);
    }
  }

  getSecret(secretName: string, itemName: string): string {
    try {
      const item = JSON.parse(execSync(`bw get item "${itemName}"`, { encoding: 'utf-8' })) as BwItem;

      if (item.fields && Array.isArray(item.fields)) {
        const field = item.fields.find(f => f.name === secretName);
        if (field) {
          return field.value;
        }
      }

      return item.notes || '';
    } catch {
      console.warn(`Warning: Failed to retrieve ${secretName} from ${itemName}`);
      return '';
    }
  }

  loadSecrets(): void {
    if (!this.checkCliInstalled()) {
      throw new Error(ERROR_MESSAGES.CLI_NOT_INSTALLED);
    }

    if (!this.checkAuthentication()) {
      this.login();
    }

    this.unlockVault();

    const projectSecrets = BwUtils.getProjectSecrets(this.project);
    console.log(`Loading secrets for ${this.project}...`);

    projectSecrets.forEach(({ env, name }) => {
      const value = this.getSecret(name, this.project);
      if (value) {
        this.secrets.set(env, value);
        process.env[env] = value;
      }
    });

    console.log('Environment variables loaded. Ready to execute commands.\n');
  }

  getLoadedSecrets(): Record<string, string> {
    const result: Record<string, string> = {};
    this.secrets.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  executeCommand(command: string): void {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/bash';
    const shellArgs = isWindows ? ['/c'] : ['-c'];

    const child = spawn(shell, [...shellArgs, command], {
      stdio: 'inherit',
      env: process.env
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });
  }
}
