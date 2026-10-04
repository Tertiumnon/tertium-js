# DB Sync Command

Copies one MySQL/MariaDB database over another — typically dev over prod. It dumps the source
on its host over SSH and pipes the dump straight into the target on its host over a second SSH
connection, so nothing is staged on disk in between. The target is backed up locally first.
**It overwrites the target**: treat it as destructive.

## Configuration

Each side is described by its own env file, the same `.env.dev` / `.env.prod` that
[deploy](../deploy/deploy.md) uses:

```env
DEPLOY_USER=deploy
DEPLOY_HOST=my-server
DATABASE_URL=mysql://user:password@127.0.0.1:3306/MyDatabase
# Optional: the database lives on another host than the app
DB_SSH_USER=deploy
DB_SSH_HOST=my-db-server
```

- SSH goes to `DB_SSH_USER@DB_SSH_HOST`, falling back to `DEPLOY_USER@DEPLOY_HOST`.
- `DATABASE_URL` is read as seen **from that host**: its host and port are passed to the client
  as written (a user may be granted only from `127.0.0.1`, not from `localhost`'s socket).
- `mysql://` and `mariadb://` URLs are accepted.

## Usage

With the env files kept in AWS SSM (the usual way, see [aws-env](../aws-env/aws-env.md)) — both
are fetched into memory and never written to disk:

```bash
bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts db-sync --from=.env.dev --to=.env.prod --dry-run
bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts db-sync --from=.env.dev --to=.env.prod
```

With local env files:

```bash
bun node_modules/@tertium/js/scripts/db-sync/db-sync.ts --from=.env.dev --to=.env.prod
```

| Flag | Meaning |
|------|---------|
| `--from=<file>` | Env file of the source (`db-sync.ts` default `.env.dev`; required for `aws-env`) |
| `--to=<file>` | Env file of the database to overwrite (`db-sync.ts` default `.env.prod`; required for `aws-env`) |
| `--dry-run` | Resolve both sides, find the binaries, count rows, then stop — writes nothing |
| `--yes`, `-y` | Skip the `Type "yes" to continue` prompt |
| `--skip-backup` | Skip the local backup of the target |
| `--backup-dir=<dir>` | Where the backup goes, relative to the project (default `backups`) |

In `package.json`, chained after any project-specific check that must pass first:

```json
{
  "scripts": {
    "db:sync:dev-to-prod": "bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts db-sync --from=.env.dev --to=.env.prod"
  }
}
```

### As Library

```typescript
import { dbSync } from '@tertium/js/scripts/db-sync/db-sync';

await dbSync({ fromEnvFile: '.env.dev', toEnvFile: '.env.prod', dryRun: true });
await dbSync({ fromEnv: { DATABASE_URL: '…', DEPLOY_USER: '…', DEPLOY_HOST: '…' }, toEnv: { … } });
```

`dbSync` throws on failure instead of exiting, so a caller can handle it.

## How It Works

1. Resolves both sides and refuses to run when they are the same database.
2. Finds `mariadb-dump`/`mysqldump` and `mariadb`/`mysql` on each host — by name, then by
   Homebrew's keg paths, since a non-interactive SSH session on macOS often lacks them on `PATH`.
3. Prints the approximate row count of each side (`information_schema.TABLE_ROWS`).
4. Dumps the target to `backups/<to>-before-sync_<timestamp>.sql`; if that fails, stops with
   nothing overwritten.
5. Asks for `yes`, then runs `dump --single-transaction --routines --triggers` on the source,
   piped into the client on the target.

The password reaches the remote commands as `MYSQL_PWD`, never as `-p<password>`, so it does not
appear in the remote host's process list; every value is single-quoted for the remote shell.
