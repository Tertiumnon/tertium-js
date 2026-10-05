export const DUMP_FLAGS = ["--single-transaction", "--routines", "--triggers"];

export const LOCAL_DUMP_CANDIDATES = [
  "mariadb-dump",
  "mysqldump",
  "C:\\Program Files\\MariaDB 11\\bin\\mariadb-dump.exe",
  "C:\\Program Files\\MariaDB 10\\bin\\mysqldump.exe",
  "C:\\Program Files\\MySQL\\MySQL Server 9.0\\bin\\mysqldump.exe",
  "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe",
  "C:\\xampp\\mysql\\bin\\mysqldump.exe",
  "/opt/homebrew/opt/mariadb/bin/mariadb-dump",
  "/usr/local/opt/mariadb/bin/mariadb-dump",
  "/opt/homebrew/opt/mysql/bin/mysqldump",
  "/usr/local/opt/mysql/bin/mysqldump",
];

export const REMOTE_DUMP_CANDIDATES = [
  "mariadb-dump",
  "mysqldump",
  "/opt/homebrew/opt/mariadb/bin/mariadb-dump",
  "/usr/local/opt/mariadb/bin/mariadb-dump",
  "/opt/homebrew/opt/mysql/bin/mysqldump",
  "/usr/local/opt/mysql/bin/mysqldump",
];

export const DEFAULT_ENV_FILE = ".env";
export const DEFAULT_BACKUP_DIR = "backups";
