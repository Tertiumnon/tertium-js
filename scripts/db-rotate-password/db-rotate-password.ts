#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import type {
  RotatePasswordOptions,
  RotatePasswordSystem,
} from "./db-rotate-password.types";

// Changes a project's database password and moves it everywhere the project reads it:
//   1. hlpr mariadb rotate-password: the database user, then the SSM parameter that holds DATABASE_URL.
//   2. The app's remote .env on the same host (a timestamped copy of the old file is kept), then a PM2 restart.
// If step 2 fails, the .env is put back and restarted, then hlpr sets the old password and the old URL back.

const USAGE =
  "Usage: db-rotate-password.ts --host=<ssh host> --ssm-param=<name> [--app-path=<dir> --app-name=<pm2 name>] [--dry-run]";

const sq = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;

export const replaceDatabaseUrl = (
  text: string,
  databaseUrl: string,
): string => {
  const line = /^(\s*DATABASE_URL\s*=\s*)(['"]?)(.*?)\2\s*$/m;
  if (!line.test(text))
    throw new Error("DATABASE_URL is not set in the app's .env");
  return text.replace(
    line,
    (_match, prefix: string, quote: string) =>
      `${prefix}${quote}${databaseUrl}${quote}`,
  );
};

export const validateOptions = (options: RotatePasswordOptions): void => {
  if ((options.appPath === undefined) !== (options.appName === undefined)) {
    throw new Error("--app-path and --app-name go together");
  }
  if (
    options.appPath !== undefined &&
    !/^\/[A-Za-z0-9_./-]+$/.test(options.appPath)
  ) {
    throw new Error("--app-path must be an absolute path such as /var/www/app");
  }
  if (
    options.appName !== undefined &&
    !/^[A-Za-z0-9._-]+$/.test(options.appName)
  ) {
    throw new Error("--app-name must be the PM2 process name");
  }
};

/** Parses `--host=… --ssm-param=… [--app-path=… --app-name=…] [--dry-run]`. */
export const parseOptions = (args: string[]): RotatePasswordOptions => {
  const values: {
    host?: string;
    "ssm-param"?: string;
    "app-path"?: string;
    "app-name"?: string;
  } = {};
  let dryRun = false;
  for (const arg of args) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    const match = arg.match(/^--(host|ssm-param|app-path|app-name)=(.+)$/);
    const key = match?.[1] as keyof typeof values | undefined;
    if (!match || !key || values[key] !== undefined) throw new Error(USAGE);
    values[key] = match[2];
  }
  if (values.host === undefined || values["ssm-param"] === undefined)
    throw new Error(USAGE);
  const options: RotatePasswordOptions = {
    host: values.host,
    ssmParam: values["ssm-param"],
    appPath: values["app-path"],
    appName: values["app-name"],
    dryRun,
  };
  validateOptions(options);
  return options;
};

const timestamp = (): string => new Date().toISOString().replace(/[:.]/g, "-");

export const rotateAppPassword = async (
  options: RotatePasswordOptions,
  system: RotatePasswordSystem,
): Promise<void> => {
  validateOptions(options);
  const hostArgs = ["-host", options.host];
  const readUrl = () =>
    system.hlpr([
      "aws-param-store",
      "read",
      "-name",
      options.ssmParam,
      "-key",
      "DATABASE_URL",
    ]);
  const app = options.appPath !== undefined && options.appName !== undefined;
  const appDir = options.appPath ?? "";
  const restartApp = () =>
    system.hlpr([
      "pm2",
      "restart",
      "-host",
      options.host,
      "-name",
      options.appName as string,
    ]);
  const writeEnv = (text: string, backup: boolean) =>
    system.ssh(
      options.host,
      `cd ${sq(appDir)} && ${backup ? `cp .env .env.bak-${timestamp()} && ` : ""}umask 077 && cat > .env.tmp && mv .env.tmp .env`,
      text,
    );

  // The current URL and .env, read before anything changes: they are the rollback targets.
  const oldUrl = readUrl();
  const oldEnv = app
    ? system.ssh(options.host, `cat ${sq(`${appDir}/.env`)}`)
    : undefined;
  if (oldEnv !== undefined) replaceDatabaseUrl(oldEnv, oldUrl); // fails before anything changes

  if (options.dryRun) {
    system.log(
      system
        .hlpr([
          "mariadb",
          "rotate-password",
          ...hostArgs,
          "-ssm-param",
          options.ssmParam,
          "-dry-run",
        ])
        .trimEnd(),
    );
    if (app)
      system.log(`Then update ${appDir}/.env and restart ${options.appName}`);
    return;
  }

  // hlpr rolls back its own steps if it fails, so nothing is left to undo when this throws.
  system.log(
    system
      .hlpr([
        "mariadb",
        "rotate-password",
        ...hostArgs,
        "-ssm-param",
        options.ssmParam,
      ])
      .trimEnd(),
  );
  if (!app || oldEnv === undefined) return;

  // From here the database and SSM hold the new password. Undo steps run in reverse, so the app is
  // put back first, then the database, then the parameter.
  const oldPassword = decodeURIComponent(new URL(oldUrl).password);
  const oldUser = new URL(oldUrl).username;
  const undo: { label: string; run: () => void }[] = [
    {
      label: options.ssmParam,
      run: () =>
        system.hlpr(
          [
            "aws-param-store",
            "set",
            "-name",
            options.ssmParam,
            "-key",
            "DATABASE_URL",
          ],
          oldUrl,
        ),
    },
    {
      label: "database password",
      run: () =>
        system.hlpr(
          ["mariadb", "set-user-password", "-db-name", oldUser, ...hostArgs],
          oldPassword,
        ),
    },
  ];

  let envWritten = false;
  try {
    const newUrl = readUrl();
    writeEnv(replaceDatabaseUrl(oldEnv, newUrl), true);
    envWritten = true;
    system.log(`✓ ${appDir}/.env updated`);

    restartApp();
    const status = system.pm2Status(options.host, options.appName as string);
    if (status !== "online")
      throw new Error(`${options.appName} is ${status} after the restart`);
    system.log(`✓ ${options.appName} restarted and online`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    system.log(`✗ ${reason}`);
    if (envWritten) {
      undo.push({
        label: `${appDir}/.env and ${options.appName}`,
        run: () => {
          writeEnv(oldEnv, false);
          restartApp();
        },
      });
    }
    for (const step of undo.reverse()) {
      try {
        step.run();
        system.log(`↩ Rolled back ${step.label}`);
      } catch (rollbackError) {
        system.log(
          `✗ Could not roll back ${step.label}: ${rollbackError instanceof Error ? rollbackError.message : rollbackError}`,
        );
      }
    }
    throw new Error(
      `Password rotation for ${options.appName} failed and was rolled back where possible: ${reason}`,
    );
  }
};

// The real system: hlpr and ssh on this machine. hlpr is an installed script, so it runs through the shell;
// its arguments are names and flags only, and every secret goes on stdin.
export const realSystem = (
  log: (message: string) => void = console.log,
): RotatePasswordSystem => ({
  hlpr: (args, input) => {
    const command = ["hlpr", ...args].map((arg) => `"${arg}"`).join(" ");
    const result = spawnSync(command, {
      encoding: "utf-8",
      input,
      shell: true,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    if (result.error)
      throw new Error(
        `Cannot run hlpr (is it installed?): ${result.error.message}`,
      );
    if (result.status !== 0)
      throw new Error(
        `hlpr ${args.slice(0, 2).join(" ")} failed: ${result.stderr.trim() || result.stdout.trim()}`,
      );
    return result.stdout;
  },
  // `hlpr pm2 status` exits 1 unless the process is online, which is an answer here, not an error.
  pm2Status: (host, name) => {
    const result = spawnSync(
      "hlpr",
      ["pm2", "status", "-host", host, "-name", name],
      {
        encoding: "utf-8",
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (result.error)
      throw new Error(
        `Cannot run hlpr (is it installed?): ${result.error.message}`,
      );
    const status = result.stdout.trim();
    if (status === "")
      throw new Error(`hlpr pm2 status failed: ${result.stderr.trim()}`);
    return status;
  },
  ssh: (host, command, input) => {
    const result = spawnSync("ssh", ["-o", "BatchMode=yes", host, command], {
      encoding: "utf-8",
      input,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    if (result.error)
      throw new Error(`Cannot run ssh: ${result.error.message}`);
    if (result.status !== 0)
      throw new Error(
        `ssh ${host} failed (exit ${result.status}): ${result.stderr.trim()}`,
      );
    return result.stdout;
  },
  log,
});

if (process.argv[1]?.includes("db-rotate-password.ts")) {
  rotateAppPassword(parseOptions(process.argv.slice(2)), realSystem()).catch(
    (error: unknown) => {
      console.error(
        `✗ ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    },
  );
}
