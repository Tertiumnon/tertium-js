/** The variables db-sync reads from one target's env file (.env.dev, .env.prod, …). */
export interface DbSyncEnv {
  /** `mysql://user:password@host:port/database` as the app on that host uses it. */
  DATABASE_URL: string;
  DEPLOY_USER?: string;
  DEPLOY_HOST?: string;
  /**
   * SSH login for the host the database runs on, when it is not the app's own
   * DEPLOY_USER@DEPLOY_HOST. The dump and the import run on that host, so
   * DATABASE_URL's host and port are as seen from there.
   */
  DB_SSH_USER?: string;
  DB_SSH_HOST?: string;
}

/** One side of a sync, resolved from its env. */
export interface DbTarget {
  label: string;
  ssh: string;
  dbHost: string;
  dbPort: string;
  dbUser: string;
  dbPassword: string;
  dbName: string;
}

export interface DbSyncConfig {
  projectDir?: string;
  /** Env file of the source database. Default ".env.dev". Ignored when `fromEnv` is set. */
  fromEnvFile?: string;
  /** Env file of the database to overwrite. Default ".env.prod". Ignored when `toEnv` is set. */
  toEnvFile?: string;
  fromEnv?: DbSyncEnv;
  toEnv?: DbSyncEnv;
  /** Skip the "type yes" prompt. */
  yes?: boolean;
  /** Skip the local backup of the target taken before it is overwritten. */
  skipBackup?: boolean;
  /** Resolve both sides, find the binaries, count rows, and stop before writing anything. */
  dryRun?: boolean;
  /** Where the target's backup goes, relative to projectDir. Default "backups". */
  backupDir?: string;
}
