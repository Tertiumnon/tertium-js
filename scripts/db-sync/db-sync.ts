#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
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
  CLIENT_CANDIDATES,
  DEFAULT_BACKUP_DIR,
  DEFAULT_FROM_ENV_FILE,
  DEFAULT_TO_ENV_FILE,
  DUMP_CANDIDATES,
  DUMP_FLAGS,
} from "./db-sync.constants";
import type { DbSyncConfig, DbSyncEnv, DbTarget } from "./db-sync.types";

const log = (message: string): void => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

// Quotes one word for the REMOTE POSIX shell that ssh hands the command string to.
const sq = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;

export const parseTarget = (env: DbSyncEnv, label: string): DbTarget => {
  const sshUser = env.DB_SSH_USER || env.DEPLOY_USER;
  const sshHost = env.DB_SSH_HOST || env.DEPLOY_HOST;
  if (!sshUser || !sshHost || !env.DATABASE_URL) {
    throw new Error(
      `${label}: DATABASE_URL and DEPLOY_USER/DEPLOY_HOST (or DB_SSH_USER/DB_SSH_HOST) are required`,
    );
  }
  const url = new URL(env.DATABASE_URL);
  if (!/^(mysql|mariadb):$/.test(url.protocol)) {
    throw new Error(
      `${label}: DATABASE_URL must be mysql:// or mariadb:// (got ${url.protocol}//)`,
    );
  }
  const dbName = decodeURIComponent(url.pathname.slice(1));
  if (!dbName) throw new Error(`${label}: DATABASE_URL names no database`);
  return {
    label,
    ssh: `${sshUser}@${sshHost}`,
    // Kept as written: a user may be granted only from that address, not from localhost.
    dbHost: url.hostname,
    dbPort: url.port || "3306",
    dbUser: decodeURIComponent(url.username),
    dbPassword: decodeURIComponent(url.password),
    dbName,
  };
};

// The password goes in MYSQL_PWD (read by both the mysql and the mariadb clients), so it never
// shows in the remote host's process list the way `-p<password>` would.
const remoteCommand = (target: DbTarget, bin: string, args: string[]): string =>
  [
    `MYSQL_PWD=${sq(target.dbPassword)}`,
    bin,
    `-h ${sq(target.dbHost)}`,
    `-P ${sq(target.dbPort)}`,
    `-u ${sq(target.dbUser)}`,
    ...args,
  ].join(" ");

const sshCapture = (
  ssh: string,
  command: string,
): { status: number; stdout: string } => {
  const proc = spawnSync("ssh", [ssh, command], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return { status: proc.status ?? 1, stdout: proc.stdout ?? "" };
};

export const detectRemoteBinary = (
  ssh: string,
  candidates: string[],
): string => {
  const probe = candidates.map((c) => `command -v ${c}`).join(" || ");
  const { status, stdout } = sshCapture(ssh, probe);
  const found = stdout.trim().split("\n")[0];
  if (status !== 0 || !found) {
    throw new Error(`None of ${candidates.join(", ")} was found on ${ssh}`);
  }
  return found;
};

// information_schema's TABLE_ROWS is an estimate for InnoDB - enough to tell empty from not.
const countRows = (target: DbTarget, clientBin: string): number => {
  const sql = `SELECT COALESCE(SUM(TABLE_ROWS),0) FROM information_schema.tables WHERE TABLE_SCHEMA='${target.dbName.replace(/'/g, "''")}'`;
  const { status, stdout } = sshCapture(
    target.ssh,
    remoteCommand(target, clientBin, ["-N", "-e", sq(sql)]),
  );
  if (status !== 0)
    throw new Error(`${target.label}: could not read ${target.dbName}`);
  return Number(stdout.trim()) || 0;
};

const waitFor = (proc: ReturnType<typeof spawn>): Promise<number> =>
  new Promise((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", (code) => resolve(code ?? 1));
  });

const dumpArgs = (target: DbTarget): string[] => [
  ...DUMP_FLAGS,
  sq(target.dbName),
];

const backupTarget = async (
  target: DbTarget,
  dumpBin: string,
  backupDir: string,
): Promise<string> => {
  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const file = path.join(
    backupDir,
    `${target.label}-before-sync_${timestamp}.sql`,
  );
  const fd = openSync(file, "w");
  const proc = spawn(
    "ssh",
    [target.ssh, remoteCommand(target, dumpBin, dumpArgs(target))],
    {
      stdio: ["ignore", fd, "inherit"],
    },
  );
  const code = await waitFor(proc).finally(() => closeSync(fd));
  if (code !== 0) {
    if (existsSync(file)) unlinkSync(file);
    throw new Error(
      `${target.label} backup failed (exit ${code}) - nothing was overwritten`,
    );
  }
  return file;
};

const envLabel = (envFile: string): string =>
  envFile.replace(/^\.env\.?/, "") || "env";

/**
 * Copies one MySQL/MariaDB database over another: dumps the source on its host over SSH and
 * pipes the dump straight into the target on its host over a second SSH connection, with no
 * intermediate file. The target is backed up locally first unless `skipBackup`. It does not ask
 * before overwriting: `dryRun` shows what a run would do.
 */
export const dbSync = async (config: DbSyncConfig = {}): Promise<void> => {
  const projectDir = config.projectDir || process.cwd();
  const fromEnvFile = config.fromEnvFile || DEFAULT_FROM_ENV_FILE;
  const toEnvFile = config.toEnvFile || DEFAULT_TO_ENV_FILE;
  const fromEnv =
    config.fromEnv ||
    (loadEnv(projectDir, fromEnvFile) as unknown as DbSyncEnv);
  const toEnv =
    config.toEnv || (loadEnv(projectDir, toEnvFile) as unknown as DbSyncEnv);
  const from = parseTarget(fromEnv, envLabel(fromEnvFile));
  const to = parseTarget(toEnv, envLabel(toEnvFile));

  if (
    from.ssh === to.ssh &&
    from.dbHost === to.dbHost &&
    from.dbPort === to.dbPort &&
    from.dbName === to.dbName
  ) {
    throw new Error(
      `Source and target are the same database (${to.dbName} on ${to.ssh})`,
    );
  }

  log(`From: ${from.dbName} on ${from.ssh} (${from.label})`);
  log(`To:   ${to.dbName} on ${to.ssh} (${to.label})`);

  const fromDumpBin = detectRemoteBinary(from.ssh, DUMP_CANDIDATES);
  const fromClientBin = detectRemoteBinary(from.ssh, CLIENT_CANDIDATES);
  const toClientBin = detectRemoteBinary(to.ssh, CLIENT_CANDIDATES);
  const toDumpBin = detectRemoteBinary(to.ssh, DUMP_CANDIDATES);

  const fromRows = countRows(from, fromClientBin);
  const toRows = countRows(to, toClientBin);
  log(
    `${from.label} has ~${fromRows} rows; ${to.label} has ~${toRows} rows, which this sync overwrites`,
  );

  if (config.dryRun) {
    log(
      `Dry run: would dump with ${fromDumpBin} on ${from.ssh} and import with ${toClientBin} on ${to.ssh}`,
    );
    return;
  }

  if (!config.skipBackup) {
    log(`Backing up ${to.label} before overwriting it...`);
    const file = await backupTarget(
      to,
      toDumpBin,
      path.join(projectDir, config.backupDir || DEFAULT_BACKUP_DIR),
    );
    log(
      `✓ Backup saved: ${file} (${(statSync(file).size / 1024 / 1024).toFixed(2)} MB)`,
    );
  } else {
    log("Skipping the backup (--skip-backup)");
  }

  log(`Dumping ${from.label} and importing into ${to.label}...`);
  const dump = spawn(
    "ssh",
    [from.ssh, remoteCommand(from, fromDumpBin, dumpArgs(from))],
    {
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  const restore = spawn(
    "ssh",
    [to.ssh, remoteCommand(to, toClientBin, [sq(to.dbName)])],
    {
      stdio: ["pipe", "inherit", "inherit"],
    },
  );
  dump.stdout?.pipe(restore.stdin as NodeJS.WritableStream);
  const [dumpExit, restoreExit] = await Promise.all([
    waitFor(dump),
    waitFor(restore),
  ]);
  if (dumpExit !== 0 || restoreExit !== 0) {
    throw new Error(
      `Sync failed (dump exit ${dumpExit}, import exit ${restoreExit})`,
    );
  }

  log(`✓ ${from.label} copied to ${to.label}`);
};

// CLI entry point - execute if called directly as a script
if (process.argv[1]?.includes("db-sync.ts")) {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined =>
    args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  dbSync({
    fromEnvFile: flag("from"),
    toEnvFile: flag("to"),
    backupDir: flag("backup-dir"),
    skipBackup: args.includes("--skip-backup"),
    dryRun: args.includes("--dry-run"),
  }).catch((error: unknown) => {
    log(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
