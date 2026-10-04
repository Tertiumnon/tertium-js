// A non-interactive SSH session on macOS often lacks Homebrew's bin on PATH, so its
// keg paths are probed by absolute path after the plain names.
export const DUMP_CANDIDATES = [
  "mariadb-dump",
  "mysqldump",
  "/opt/homebrew/opt/mariadb/bin/mariadb-dump",
  "/usr/local/opt/mariadb/bin/mariadb-dump",
  "/opt/homebrew/opt/mysql/bin/mysqldump",
  "/usr/local/opt/mysql/bin/mysqldump",
];

export const CLIENT_CANDIDATES = [
  "mariadb",
  "mysql",
  "/opt/homebrew/opt/mariadb/bin/mariadb",
  "/usr/local/opt/mariadb/bin/mariadb",
  "/opt/homebrew/opt/mysql/bin/mysql",
  "/usr/local/opt/mysql/bin/mysql",
];

// A consistent InnoDB snapshot without locking the source, with routines and triggers.
export const DUMP_FLAGS = ["--single-transaction", "--routines", "--triggers"];

export const DEFAULT_FROM_ENV_FILE = ".env.dev";
export const DEFAULT_TO_ENV_FILE = ".env.prod";
export const DEFAULT_BACKUP_DIR = "backups";
