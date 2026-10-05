#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  statSync,
  unlinkSync,
} from "node:fs";
import * as path from "node:path";
import { loadEnv } from "../deploy/deploy";
import {
  DEFAULT_BACKUP_DIR,
  DEFAULT_ENV_FILE,
  DUMP_FLAGS,
} from "./db-backup.constants";
import type { DbBackupConfig, DbBackupEnv } from "./db-backup.types";
import {
  findLocalDump,
  findRemoteDump,
  parseDatabaseUrl,
  sq,
  waitFor,
} from "./db-backup.utils";

const log = (message: string): void => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

/** Creates a complete MySQL/MariaDB SQL dump and returns its absolute filename. */
export const dbBackup = async (
  config: DbBackupConfig = {},
): Promise<string> => {
  const projectDir = config.projectDir || process.cwd();
  const envFile = config.envFile || DEFAULT_ENV_FILE;
  const env =
    config.env || (loadEnv(projectDir, envFile) as unknown as DbBackupEnv);
  if (!env.DATABASE_URL)
    throw new Error(`${envFile}: DATABASE_URL is required`);

  const target = parseDatabaseUrl(env.DATABASE_URL);
  const sshUser = env.DB_SSH_USER || env.DEPLOY_USER;
  const sshHost = env.DB_SSH_HOST || env.DEPLOY_HOST;
  if ((sshUser && !sshHost) || (!sshUser && sshHost)) {
    throw new Error(
      `${envFile}: both DB_SSH_USER/DB_SSH_HOST (or DEPLOY_USER/DEPLOY_HOST) are required for SSH backup`,
    );
  }

  const backupDir = path.resolve(
    projectDir,
    config.backupDir || DEFAULT_BACKUP_DIR,
  );
  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const prefix = config.filenamePrefix || "backup";
  if (prefix !== path.basename(prefix) || prefix === "." || prefix === "..") {
    throw new Error("filenamePrefix must be a filename, not a path");
  }
  const backupFile = path.join(backupDir, `${prefix}_${timestamp}.sql`);
  const ssh = sshUser && sshHost ? `${sshUser}@${sshHost}` : undefined;
  const dumpBin = ssh ? findRemoteDump(ssh) : findLocalDump();

  log(
    `Backing up ${target.database}${ssh ? ` through ${ssh}` : " locally"}...`,
  );
  const commonArgs = [
    `-h${target.host}`,
    `-P${target.port}`,
    `-u${target.user}`,
    ...DUMP_FLAGS,
    target.database,
  ];
  const fd = openSync(backupFile, "w");
  try {
    const proc = ssh
      ? spawn(
          "ssh",
          [
            ssh,
            [
              `MYSQL_PWD=${sq(target.password)}`,
              sq(dumpBin),
              ...commonArgs.map(sq),
            ].join(" "),
          ],
          { stdio: ["ignore", fd, "inherit"] },
        )
      : spawn(dumpBin, commonArgs, {
          env: { ...process.env, MYSQL_PWD: target.password },
          stdio: ["ignore", fd, "inherit"],
        });
    const code = await waitFor(proc);
    if (code !== 0) throw new Error(`Database backup failed (exit ${code})`);
  } catch (error) {
    closeSync(fd);
    if (existsSync(backupFile)) unlinkSync(backupFile);
    throw error;
  }
  closeSync(fd);

  const bytes = statSync(backupFile).size;
  if (bytes === 0) {
    unlinkSync(backupFile);
    throw new Error("Database backup produced an empty file");
  }
  log(`✓ Backup saved: ${backupFile} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
  return backupFile;
};

if (process.argv[1]?.includes("db-backup.ts")) {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  dbBackup({
    envFile: flag("env-file"),
    backupDir: flag("backup-dir"),
    filenamePrefix: flag("prefix"),
  }).catch((error: unknown) => {
    log(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
