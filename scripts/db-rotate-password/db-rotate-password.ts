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
// The host is not a flag: the parameter names it (DB_SSH_HOST or DEPLOY_HOST, with the matching USER key).

const USAGE =
  "Usage: db-rotate-password.ts --ssm-param=<name> [--app-path=<dir> --app-name=<pm2 name>] [--dry-run]";

const sq = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;

/** The value of KEY in a .env text: the first assignment, without quotes or a trailing comment. */
export const envValue = (text: string, key: string): string | undefined => {
  const match = text.match(
    new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=\\s*(.*?)\\s*$`, "m"),
  );
  if (!match) return undefined;
  const raw = match[1] ?? "";
  const quoted = raw.match(/^(['"])(.*)\1$/);
  return quoted ? quoted[2] : raw.replace(/\s+#.*$/, "");
};

/** The ssh destination an env value names: user@host, or the host alone when no user is set. */
export const sshDestinationFromEnv = (text: string): string => {
  const host = envValue(text, "DB_SSH_HOST") ?? envValue(text, "DEPLOY_HOST");
  if (host === undefined || host === "")
    throw new Error("The SSM parameter has no DB_SSH_HOST or DEPLOY_HOST");
  const user = envValue(text, "DB_SSH_USER") ?? envValue(text, "DEPLOY_USER");
  return user ? `${user}@${host}` : host;
};

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
  if (!/^\/[A-Za-z0-9_./-]+$/.test(options.ssmParam)) {
    throw new Error(
      "--ssm-param must be a parameter name such as /env/app/env.prod",
    );
  }
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

/** Parses `--ssm-param=… [--app-path=… --app-name=…] [--dry-run]`. */
export const parseOptions = (args: string[]): RotatePasswordOptions => {
  const values: {
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
    const match = arg.match(/^--(ssm-param|app-path|app-name)=(.+)$/);
    const key = match?.[1] as keyof typeof values | undefined;
    if (!match || !key || values[key] !== undefined) throw new Error(USAGE);
    values[key] = match[2];
  }
  if (values["ssm-param"] === undefined) throw new Error(USAGE);
  const options: RotatePasswordOptions = {
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
  const param = options.ssmParam;
  const app = options.appPath !== undefined && options.appName !== undefined;
  const appDir = options.appPath ?? "";
  const name = options.appName as string;

  // The parameter's env value, read before anything changes: the host and the rollback targets come from it.
  const readParam = () =>
    system.hlpr(["aws-param-store", "read", "-name", param]);
  const before = readParam();
  const host = sshDestinationFromEnv(before);
  const oldUrl = envValue(before, "DATABASE_URL");
  if (oldUrl === undefined)
    throw new Error("The SSM parameter has no DATABASE_URL");

  const restartApp = () =>
    system.hlpr(["pm2", "restart", "-ssm-param", param, "-name", name]);
  const writeEnv = (text: string, backup: boolean) =>
    system.ssh(
      host,
      `cd ${sq(appDir)} && ${backup ? `cp .env .env.bak-${timestamp()} && ` : ""}umask 077 && cat > .env.tmp && mv .env.tmp .env`,
      text,
    );

  // The app's current .env: it is the rollback target, and a missing DATABASE_URL in it fails before anything changes.
  const oldEnv = app
    ? system.ssh(host, `cat ${sq(`${appDir}/.env`)}`)
    : undefined;
  if (oldEnv !== undefined) replaceDatabaseUrl(oldEnv, oldUrl);

  if (options.dryRun) {
    system.log(
      system
        .hlpr(["mariadb", "rotate-password", "-ssm-param", param, "-dry-run"])
        .trimEnd(),
    );
    if (app)
      system.log(`Then update ${appDir}/.env on ${host} and restart ${name}`);
    return;
  }

  // hlpr rolls back its own steps if it fails, so nothing is left to undo when this throws.
  system.log(
    system.hlpr(["mariadb", "rotate-password", "-ssm-param", param]).trimEnd(),
  );
  if (!app || oldEnv === undefined) return;

  // From here the database and SSM hold the new password. Undo steps run in reverse, so the app is
  // put back first, then the database, then the parameter.
  const oldPassword = decodeURIComponent(new URL(oldUrl).password);
  const oldUser = new URL(oldUrl).username;
  const undo: { label: string; run: () => void }[] = [
    {
      label: param,
      run: () =>
        system.hlpr(
          ["aws-param-store", "set", "-name", param, "-key", "DATABASE_URL"],
          oldUrl,
        ),
    },
    {
      label: "database password",
      run: () =>
        system.hlpr(
          [
            "mariadb",
            "set-user-password",
            "-db-name",
            oldUser,
            "-ssm-param",
            param,
          ],
          oldPassword,
        ),
    },
  ];

  let envWritten = false;
  try {
    const newUrl = envValue(readParam(), "DATABASE_URL") as string;
    writeEnv(replaceDatabaseUrl(oldEnv, newUrl), true);
    envWritten = true;
    system.log(`✓ ${appDir}/.env updated on ${host}`);

    restartApp();
    const status = system.pm2Status(param, name);
    if (status !== "online")
      throw new Error(`${name} is ${status} after the restart`);
    system.log(`✓ ${name} restarted and online`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    system.log(`✗ ${reason}`);
    if (envWritten) {
      undo.push({
        label: `${appDir}/.env and ${name}`,
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
      `Password rotation for ${name} failed and was rolled back where possible: ${reason}`,
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
  pm2Status: (ssmParam, name) => {
    const command = [
      "hlpr",
      "pm2",
      "status",
      "-ssm-param",
      ssmParam,
      "-name",
      name,
    ]
      .map((arg) => `"${arg}"`)
      .join(" ");
    const result = spawnSync(command, {
      encoding: "utf-8",
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
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
