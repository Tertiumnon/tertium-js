#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { deploy as runDeploy } from "../deploy/deploy";
import type { AwsEnvConfig } from "./aws-env.types";

const ENV_FILE_SUGGESTIONS = [".env", ".env.dev", ".env.prod", ".env.staging"];

// Marks a local env file as written by `sync` rather than hand-edited, so `push` can
// warn before re-uploading a synced copy (with its header) back over the real source.
const SYNC_HEADER_PREFIX = "# auto-synced from AWS SSM";

const log = (message: string): void => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

// Every command here shells out to the `aws` CLI with parameter names starting in "/"
// (e.g. "/env/my-app/env"). Git Bash's MSYS layer rewrites a leading-slash argument as
// if it were a Unix path and mangles it into something like "C:/Program Files/Git/env/
// ...", which the AWS API then rejects as an invalid parameter name. MSYS_NO_PATHCONV=1
// disables that rewriting; it's a no-op outside Git Bash on Windows.
const AWS_CLI_ENV = { ...process.env, MSYS_NO_PATHCONV: "1" };

const run = (command: string, cwd: string): void => {
  console.log(`→ ${command}`);
  // Note: stdio: "inherit" requires object-style options, but TypeScript's
  // ExecSyncOptions type doesn't properly support this combination.
  const options = { stdio: "inherit", cwd, shell: true, env: AWS_CLI_ENV };
  // biome-ignore lint/suspicious/noExplicitAny: Node.js types limitation
  execSync(command, options as any);
};

const runCapture = (command: string, cwd: string): string => {
  console.log(`→ ${command}`);
  const options = { cwd, shell: true, encoding: "utf-8", env: AWS_CLI_ENV };
  // biome-ignore lint/suspicious/noExplicitAny: Node.js types limitation (see run())
  const output = execSync(command, options as any) as string;
  return output.trim();
};

const awsCommonFlags = (config: AwsEnvConfig): string => {
  const parts: string[] = [];
  if (config.region) parts.push(`--region ${config.region}`);
  if (config.profile) parts.push(`--profile ${config.profile}`);
  return parts.length ? ` ${parts.join(" ")}` : "";
};

// Auto-detect a repo name from package.json's "name" (scope stripped), falling back to
// the project directory's basename - used to build a default SSM parameter path.
const detectRepoName = (projectDir: string): string => {
  const pkgPath = path.join(projectDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (typeof pkg.name === "string" && pkg.name) {
        return pkg.name.replace(/^@[^/]+\//, "");
      }
    } catch {
      // fall through to directory basename
    }
  }
  return path.basename(projectDir);
};

// Resolve the full SSM parameter name: explicit `paramName` wins outright, otherwise
// `${paramPrefix}/${repoName}/${envFile with leading dots stripped}`
// e.g. ".env.dev" in project "my-app" -> "/env/my-app/env.dev"
export const resolveParamName = (config: AwsEnvConfig): string => {
  if (config.paramName) return config.paramName;
  const projectDir = config.projectDir || process.cwd();
  const prefix = (config.paramPrefix || "/env").replace(/\/+$/, "");
  const repoName = config.repoName || detectRepoName(projectDir);
  const envFile = config.envFile || ".env";
  const suffix = envFile.replace(/^\.+/, "") || "env";
  return `${prefix}/${repoName}/${suffix}`;
};

const parseEnvContent = (content: string): Record<string, string> => {
  const vars: Record<string, string> = {};
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length > 0) {
      vars[key.trim()] = valueParts.join("=").trim();
    }
  });
  return vars;
};

// Upload a local env file to SSM Parameter Store as a SecureString, preserving it
// byte-for-byte (comments, blank lines, formatting) so `pull` can restore it exactly.
export const pushEnv = (config: AwsEnvConfig = {}): void => {
  const projectDir = config.projectDir || process.cwd();
  const envFile = config.envFile || ".env";
  const envPath = path.join(projectDir, envFile);

  if (!existsSync(envPath)) {
    const found = ENV_FILE_SUGGESTIONS.filter((f) =>
      existsSync(path.join(projectDir, f)),
    );
    let message = `Error: ${envFile} file not found at ${projectDir}`;
    if (found.length > 0) {
      message += `\nAvailable env files: ${found.join(", ")}`;
    }
    console.error(message);
    process.exit(1);
  }

  const firstLine = readFileSync(envPath, "utf-8").split("\n", 1)[0] ?? "";
  if (firstLine.startsWith(SYNC_HEADER_PREFIX)) {
    log(
      `⚠ ${envFile} looks auto-synced (has a \`sync\` header) - uploading it will also push ` +
        "that header line as real content. Edit the file to remove it first if that's not intended.",
    );
  }

  const paramName = resolveParamName(config);
  log(`Uploading ${envFile} to SSM parameter ${paramName}...`);

  try {
    const fileUri = `file://${envPath.replace(/\\/g, "/")}`;
    run(
      // --output explicit rather than relying on the caller's configured default -
      // an invalid `output` value in ~/.aws/config (seen in practice: "JSON" instead
      // of "json" - AWS CLI's output type is case-sensitive) breaks response
      // formatting even though the underlying API call succeeds.
      `aws ssm put-parameter --name "${paramName}" --type SecureString --tier Standard --overwrite --value ${fileUri} --output json${awsCommonFlags(config)}`,
      projectDir,
    );
    log(`✓ Uploaded ${envFile} → ${paramName}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log(`✗ Upload failed: ${message}`);
    process.exit(1);
  }
};

// AWS CLI's `--output text` emits CRLF line endings on Windows regardless of what was
// uploaded - normalize back to LF so a fetched value matches what `push` read in.
const fetchParamValue = (config: AwsEnvConfig, projectDir: string): string => {
  const paramName = resolveParamName(config);
  const raw = runCapture(
    `aws ssm get-parameter --name "${paramName}" --with-decryption --query Parameter.Value --output text${awsCommonFlags(config)}`,
    projectDir,
  );
  return raw.replace(/\r\n/g, "\n");
};

// Fetch a parameter and write it back to a local env file, unconditionally - errors out
// if AWS is unreachable. Use this when you specifically want the exact current source
// (e.g. debugging what's actually stored). For routine day-to-day use where you don't
// want a network hiccup to block starting the app, use `sync` instead.
export const pullEnv = (config: AwsEnvConfig = {}): void => {
  const projectDir = config.projectDir || process.cwd();
  const envFile = config.envFile || ".env";
  const envPath = path.join(projectDir, envFile);
  const paramName = resolveParamName(config);

  log(`Fetching ${paramName} → ${envFile}...`);
  try {
    const content = fetchParamValue(config, projectDir);
    writeFileSync(
      envPath,
      content.endsWith("\n") ? content : `${content}\n`,
      "utf-8",
    );
    log(`✓ Wrote ${envFile}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log(`✗ Fetch failed: ${message}`);
    process.exit(1);
  }
};

// Refresh the local env file from AWS, but degrade gracefully instead of blocking: if
// AWS is unreachable and a local copy already exists, keep it as-is (with a warning)
// rather than failing outright. Only errors out if there's no local copy to fall back
// to. This is what makes the local file act as an offline-capable cache of the AWS
// value rather than a second hand-maintained source of truth - `run` never touches the
// network at all, it just reads whatever `sync` last wrote.
export const syncEnv = (config: AwsEnvConfig = {}): void => {
  const projectDir = config.projectDir || process.cwd();
  const envFile = config.envFile || ".env";
  const envPath = path.join(projectDir, envFile);
  const paramName = resolveParamName(config);

  log(`Syncing ${paramName} → ${envFile}...`);
  try {
    const content = fetchParamValue(config, projectDir);
    const header = `${SYNC_HEADER_PREFIX} (${paramName}) at ${new Date().toISOString()} - do not hand-edit, run \`aws-env push\` against the real source instead\n`;
    writeFileSync(
      envPath,
      header + (content.endsWith("\n") ? content : `${content}\n`),
      "utf-8",
    );
    log(`✓ Synced ${envFile} from ${paramName}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (existsSync(envPath)) {
      log(
        `⚠ Could not reach AWS (${message.split("\n")[0]}) - keeping existing local ${envFile} unchanged`,
      );
      return;
    }
    log(
      `✗ Sync failed and no local ${envFile} exists to fall back to: ${message}`,
    );
    process.exit(1);
  }
};

// Read the local env file (last written by `push`, `pull`, or `sync`), parse it as
// KEY=VALUE lines, and run a command with those variables merged into its environment.
// Purely local - never touches the network, so it can't be blocked by a connectivity
// issue. Run `sync` beforehand (routinely, e.g. once per session) to keep this fresh.
export const runWithEnv = (config: AwsEnvConfig, command: string[]): void => {
  const projectDir = config.projectDir || process.cwd();
  const envFile = config.envFile || ".env";
  const envPath = path.join(projectDir, envFile);

  if (!existsSync(envPath)) {
    console.error(
      `Error: ${envFile} not found at ${projectDir}. Run \`aws-env sync\` (or \`pull\`) first to create a local cache.`,
    );
    process.exit(1);
  }

  const content = readFileSync(envPath, "utf-8");
  const vars = parseEnvContent(content);
  const mergedEnv = { ...process.env, ...vars };
  const commandStr = command.join(" ");

  log(
    `Running with ${Object.keys(vars).length} vars from ${envFile}: ${commandStr}`,
  );
  execSync(commandStr, {
    stdio: "inherit",
    cwd: projectDir,
    shell: true,
    env: mergedEnv,
    // biome-ignore lint/suspicious/noExplicitAny: Node.js types limitation (see run())
  } as any);
};

// Deploy using an env file that exists ONLY for the duration of this call: fetched
// fresh from AWS into a distinctly-named temp file (never the real .env.dev/.env.prod,
// so it can't collide with or clobber one you happen to still have locally), passed to
// the existing deploy() as its envFile, then removed. Requires an explicit --env-file
// (not ".env") - deploying without naming dev/prod is too easy to get wrong.
//
// deploy() itself calls process.exit(1) directly on validation/deploy failure rather
// than throwing, which would skip a plain try/finally. `process.on("exit", ...)` fires
// synchronously even when process.exit() is called deep inside deploy(), so the temp
// file is always removed no matter how the deploy ends (success, validation failure,
// deploy failure, or Ctrl+C).
export const deployWithEnv = (
  config: AwsEnvConfig,
  opts: { skipBuild?: boolean } = {},
): void => {
  const projectDir = config.projectDir || process.cwd();
  const envFile = config.envFile;
  if (!envFile || envFile === ".env") {
    console.error(
      "Error: `aws-env deploy` requires an explicit --env-file=.env.dev (or .env.prod, " +
        "etc.) - deploying without naming a target is too easy to get wrong.",
    );
    process.exit(1);
    return;
  }

  const tempFileName = `${envFile}.deploy-tmp`;
  const tempPath = path.join(projectDir, tempFileName);

  if (existsSync(tempPath)) {
    log(
      `Removing stale ${tempFileName} left over from a previous interrupted deploy...`,
    );
    unlinkSync(tempPath);
  }

  const paramName = resolveParamName(config);
  log(
    `Fetching ${paramName} → ${tempFileName} (deploy-only - deleted immediately after)...`,
  );

  let content: string;
  try {
    content = fetchParamValue(config, projectDir);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log(`✗ Fetch failed: ${message}`);
    process.exit(1);
    return;
  }

  writeFileSync(
    tempPath,
    content.endsWith("\n") ? content : `${content}\n`,
    "utf-8",
  );

  process.once("exit", () => {
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
      log(`✓ Removed temporary ${tempFileName}`);
    }
  });

  runDeploy({ projectDir, envFile: tempFileName, skipBuild: opts.skipBuild });
};

// CLI entry point - execute if called directly as a script
if (process.argv[1]?.includes("aws-env.ts")) {
  const subcommand = process.argv[2];
  const dashIndex = process.argv.indexOf("--");
  const flagArgs = process.argv.slice(
    3,
    dashIndex === -1 ? undefined : dashIndex,
  );
  const passthrough = dashIndex === -1 ? [] : process.argv.slice(dashIndex + 1);

  const getFlag = (name: string): string | undefined => {
    const arg = flagArgs.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.slice(name.length + 3) : undefined;
  };

  const config: AwsEnvConfig = {
    envFile: getFlag("env-file"),
    paramPrefix: getFlag("prefix"),
    repoName: getFlag("repo"),
    paramName: getFlag("param"),
    region: getFlag("region"),
    profile: getFlag("profile"),
  };

  switch (subcommand) {
    case "push":
      pushEnv(config);
      break;
    case "pull":
      pullEnv(config);
      break;
    case "sync":
      syncEnv(config);
      break;
    case "run":
      if (passthrough.length === 0) {
        console.error(
          "Error: `aws-env run` requires a command after --, e.g.\n" +
            "  bun scripts/aws-env/aws-env.ts run --env-file=.env.dev -- bun run dev",
        );
        process.exit(1);
      }
      runWithEnv(config, passthrough);
      break;
    case "deploy":
      deployWithEnv(config, { skipBuild: flagArgs.includes("--skip-build") });
      break;
    default:
      console.error(
        `Unknown subcommand "${subcommand ?? ""}". Usage: aws-env.ts <push|pull|sync|run|deploy> [--env-file=.env] [--prefix=/env] [--repo=name] [--param=/full/name] [--region=...] [--profile=...] [--skip-build] [-- <command...>]`,
      );
      process.exit(1);
  }
}
