# DB Backup Command

Creates a complete MySQL/MariaDB SQL dump with schema, data, indexes, routines, and triggers.
It runs `mariadb-dump` or `mysqldump` locally, or on the database host over SSH when the env
contains `DB_SSH_USER`/`DB_SSH_HOST` (falling back to `DEPLOY_USER`/`DEPLOY_HOST`).

## Usage

```bash
# Local env file (defaults to .env)
bun node_modules/@tertium/js/scripts/db-backup/db-backup.ts
bun node_modules/@tertium/js/scripts/db-backup/db-backup.ts --env-file=.env.prod

# Env fetched from AWS SSM into memory only
bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts db-backup --env-file=.env.prod
```

| Flag | Meaning |
|------|---------|
| `--env-file=<file>` | Target env file (default `.env`; required with `aws-env`) |
| `--backup-dir=<dir>` | Output directory relative to the project (default `backups`) |
| `--prefix=<name>` | Output filename prefix (default `backup`) |

The output is `backups/backup_<timestamp>.sql`. The password is passed through `MYSQL_PWD`, not
the process arguments. Install a MariaDB or MySQL command-line client on the machine where the
dump runs; unlike a project-specific Prisma fallback, the native dump preserves all database
objects and works independently of the application's ORM.

## As a library

```typescript
import { dbBackup } from "@tertium/js/scripts/db-backup/db-backup";

const file = await dbBackup({ envFile: ".env.prod" });
const other = await dbBackup({ env: { DATABASE_URL: "mysql://..." } });
```

`dbBackup` returns the absolute output filename and throws on failure. Partial and empty files
are removed automatically.
