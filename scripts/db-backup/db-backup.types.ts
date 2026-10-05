export interface DbBackupEnv {
  DATABASE_URL: string;
  DEPLOY_USER?: string;
  DEPLOY_HOST?: string;
  DB_SSH_USER?: string;
  DB_SSH_HOST?: string;
}

export interface DbBackupTarget {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

export interface DbBackupConfig {
  projectDir?: string;
  /** Default ".env". Ignored when env is supplied directly. */
  envFile?: string;
  env?: DbBackupEnv;
  /** Output directory, relative to projectDir. Default "backups". */
  backupDir?: string;
  /** Filename prefix. Default "backup". */
  filenamePrefix?: string;
}
