# DB Rotate Password Script

Changes a Node/Bun project's database password and moves it everywhere the project reads it, with no manual step:

```bash
bun node_modules/@tertium/js/scripts/db-rotate-password/db-rotate-password.ts \
  --host=<ssh host> --ssm-param=/env/<project>/env.dev \
  --app-path=/var/www/<project> --app-name=<pm2 name>
```

| Flag | Meaning |
|------|---------|
| `--host=<ssh host>` | The host the database and the app run on: a Host alias or HostName from `~/.ssh/config`. |
| `--ssm-param=<name>` | The SSM parameter whose value is the app's env file. Its `DATABASE_URL` names the user and database. |
| `--app-path=<dir>` | The app's directory on that host, holding `.env`. Needs `--app-name`. |
| `--app-name=<pm2 name>` | The PM2 process name of the app, restarted so it reads the new `.env`. Needs `--app-path`. |
| `--dry-run` | Prints the plan and changes nothing. |

Without `--app-path` and `--app-name`, only the database and the parameter change.

## What it does, in order

1. Reads the current `DATABASE_URL` from the parameter and the app's `.env`. Stops before any change if the app has no `DATABASE_URL`.
2. Runs `hlpr mariadb rotate-password`: a new random password is set for the database user, the new password is checked by logging in, and the parameter is written with the new `DATABASE_URL`. `hlpr` undoes its own steps if one of them fails.
3. Reads the new `DATABASE_URL` back from the parameter.
4. Writes the app's `.env` on the host with the new `DATABASE_URL` (a timestamped copy of the old file is kept next to it), then runs `hlpr pm2 restart`.
5. Checks the PM2 status with `hlpr pm2 status`; it must be `online`.

If step 4 or 5 fails, the script undoes what it did, in reverse: the old `.env` is written back and the app restarted, the database password is set back with `hlpr mariadb set-user-password`, and the parameter is set back to the old `DATABASE_URL` with `hlpr aws-param-store set`.

## Requirements

- `hlpr` on the PATH, with the `mariadb`, `aws-param-store` and `pm2` commands.
- `ssh` to the host, with key-based access (`BatchMode`, so it never prompts).
- The AWS CLI with read and write access to the parameter.
- A MariaDB administrator login on the host for `ALTER USER` (see `hlpr mariadb rotate-password`).

## Notes

- Passwords never appear in arguments or in commands. They travel on stdin, and the output never shows them.
- The database user's password changes on every host row of that user, so other clients that use the same account need the new password too.
- Between the database change and the restart, new connections from the app fail. Existing connections keep working until they close.
- The `.env.bak-<timestamp>` copies on the host hold old passwords. Remove them once the rotation is confirmed.
