import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';

import type { BwField, BwItem, EnvVars } from './bw.types.js';
import { PROJECT_SECRETS, ERROR_MESSAGES, AVAILABLE_PROJECTS } from './bw.constants.js';

export class BwUtils {
  static parseEnvFile(filePath: string): EnvVars {
    if (!fs.existsSync(filePath)) {
      throw new Error(`${ERROR_MESSAGES.FILE_NOT_FOUND}: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const env: EnvVars = {};

    content.split('\n').forEach((line: string) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;

      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=').trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[key.trim()] = value;
      }
    });

    return env;
  }

  static validateProject(project: string): void {
    if (!AVAILABLE_PROJECTS.includes(project)) {
      throw new Error(`${ERROR_MESSAGES.INVALID_PROJECT}: ${project}`);
    }
  }

  static getProjectSecrets(project: string) {
    return PROJECT_SECRETS[project as keyof typeof PROJECT_SECRETS];
  }

  static formatEnvDisplay(envVars: EnvVars): string[] {
    return Object.entries(envVars).map(([key, value]) => {
      const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
      return `  • ${key} = ${displayValue}`;
    });
  }

  static parseJsonSafely(jsonString: string): unknown {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static ensureFieldsArray(item: BwItem): void {
    if (!item.fields) {
      item.fields = [];
    }
  }

  static createBwField(name: string, value: string): BwField {
    return {
      type: 0, // Text field
      name,
      value
    };
  }

  static updateItemFields(item: BwItem, envVars: EnvVars): void {
    this.ensureFieldsArray(item);

    const fieldsToKeep = item.fields!.filter(f => !Object.keys(envVars).includes(f.name));

    Object.entries(envVars).forEach(([key, value]) => {
      const existingField = fieldsToKeep.find(f => f.name === key);
      if (existingField) {
        existingField.value = value;
      } else {
        fieldsToKeep.push(this.createBwField(key, value));
      }
    });

    item.fields = fieldsToKeep;
  }

  static getTempFilePath(prefix = 'bw-item'): string {
    return `${os.tmpdir()}/${prefix}-${Date.now()}.json`;
  }

  static writeTempFile(filePath: string, data: Record<string, unknown>): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  static deleteTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn(`Warning: Failed to delete temp file ${filePath}`);
    }
  }

  static executeCommand(command: string): string {
    try {
      return execSync(command, { encoding: 'utf-8' }).trim();
    } catch (error) {
      throw new Error(`Command failed: ${command}`);
    }
  }
}
