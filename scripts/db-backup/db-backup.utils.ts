import { type spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";
import {
  LOCAL_DUMP_CANDIDATES,
  REMOTE_DUMP_CANDIDATES,
} from "./db-backup.constants";
import type { DbBackupTarget } from "./db-backup.types";

export const waitFor = (proc: ReturnType<typeof spawn>): Promise<number> =>
  new Promise((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", (code) => resolve(code ?? 1));
  });

/** Quotes one value for the remote POSIX shell SSH hands the command to. */
export const sq = (value: string): string =>
  `'${value.replace(/'/g, "'\\''")}'`;

export const findLocalDump = (): string => {
  for (const candidate of LOCAL_DUMP_CANDIDATES) {
    if (path.isAbsolute(candidate) && !existsSync(candidate)) continue;
    const probe = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (!probe.error && probe.status === 0) return candidate;
  }
  throw new Error(
    "mariadb-dump or mysqldump was not found. Install a MariaDB/MySQL client or add it to PATH",
  );
};

export const findRemoteDump = (ssh: string): string => {
  const probe = REMOTE_DUMP_CANDIDATES.map((candidate) =>
    path.posix.isAbsolute(candidate)
      ? `[ -x ${sq(candidate)} ] && printf '%s\\n' ${sq(candidate)}`
      : `command -v ${candidate}`,
  ).join(" || ");
  const result = spawnSync("ssh", [ssh, probe], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  const found = result.stdout?.trim().split("\n")[0];
  if (result.status !== 0 || !found) {
    throw new Error(`mariadb-dump or mysqldump was not found on ${ssh}`);
  }
  return found;
};

export const parseDatabaseUrl = (databaseUrl: string): DbBackupTarget => {
  const url = new URL(databaseUrl);
  if (!/^(mysql|mariadb):$/.test(url.protocol)) {
    throw new Error(
      `DATABASE_URL must be mysql:// or mariadb:// (got ${url.protocol}//)`,
    );
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database) throw new Error("DATABASE_URL names no database");
  return {
    host: url.hostname,
    port: url.port || "3306",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
};
