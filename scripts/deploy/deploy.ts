#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import type { DeployConfig, DeployEnv } from "./deploy.types";

const LOCKFILE_CANDIDATES = ["bun.lockb", "bun.lock", "package-lock.json"];

const log = (message: string): void => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

const run = (command: string, cwd: string): void => {
  console.log(`→ ${command}`);
  // Note: stdio: "inherit" requires object-style options, but TypeScript's
  // ExecSyncOptions type doesn't properly support this combination.
  // biome-ignore lint/suspicious/noExplicitAny: Node.js types limitation
  execSync(command, { stdio: "inherit", cwd, shell: true } as any);
};

// Load .env file (supports custom env files like .env.dev, .env.prod, etc.)
export const loadEnv = (
  projectDir: string,
  envFile: string = ".env",
): DeployEnv => {
  const envPath = path.join(projectDir, envFile);
  if (!existsSync(envPath)) {
    const suggestions = [".env", ".env.dev", ".env.prod", ".env.staging"];
    const found = suggestions.filter((f) =>
      existsSync(path.join(projectDir, f)),
    );
    let message = `Error: ${envFile} file not found at ${projectDir}`;
    if (found.length > 0) {
      message += `\nAvailable config files: ${found.join(", ")}`;
      message += `\nUse: bun scripts/deploy/deploy.ts --env-file=${found[0]}`;
    } else {
      message += `\nPlease create ${envFile} or copy .env.example to ${envFile} in ${projectDir}`;
    }
    console.error(message);
    process.exit(1);
  }

  const env: Record<string, string> = {};
  const content = readFileSync(envPath, "utf-8");

  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join("=").trim();
    }
  });

  log(`Loaded config from ${envFile}`);
  return env as unknown as DeployEnv;
};

// Validate environment variables
export const validate = (env: DeployEnv): void => {
  const missing = [];
  if (!env.DEPLOY_USER) missing.push("DEPLOY_USER");
  if (!env.DEPLOY_HOST) missing.push("DEPLOY_HOST");
  if (!env.DEPLOY_PATH) missing.push("DEPLOY_PATH");

  if (missing.length > 0) {
    console.error(
      `Error: Missing environment variables: ${missing.join(", ")}`,
    );
    process.exit(1);
  }

  const deployPath = env.DEPLOY_PATH;
  if (!deployPath.startsWith("/") || deployPath === "/") {
    console.error(
      `Error: DEPLOY_PATH must be an absolute path and not "/" (got: "${deployPath}"). ` +
        "Refusing to run a remote clean step against an unsafe path.",
    );
    process.exit(1);
  }

  if (env.STATIC_SITE !== "true" && !env.APP_NAME) {
    console.error(
      "Error: APP_NAME is required for non-static site deployments",
    );
    process.exit(1);
  }
};

const findLocalLockfile = (projectDir: string): string | null => {
  for (const candidate of LOCKFILE_CANDIDATES) {
    if (existsSync(path.join(projectDir, candidate))) return candidate;
  }
  return null;
};

const buildLocal = (env: DeployEnv, projectDir: string): void => {
  const buildCommand = env.BUILD_COMMAND || "bun run build";
  log("Building application locally...");
  run(buildCommand, projectDir);
};

// Remove everything under DEPLOY_PATH except .env, so stale files (old
// package.json, mismatched lockfiles, old builds) can never linger between
// deployments. Creates DEPLOY_PATH first in case this is the first deploy.
const cleanRemote = (env: DeployEnv): void => {
  log(`Cleaning remote directory (preserving .env): ${env.DEPLOY_PATH}`);
  const remoteCmd =
    `mkdir -p '${env.DEPLOY_PATH}' && cd '${env.DEPLOY_PATH}' && ` +
    `find . -mindepth 1 -maxdepth 1 ! -name '.env' -exec rm -rf {} +`;
  run(
    `ssh ${env.DEPLOY_USER}@${env.DEPLOY_HOST} "${remoteCmd}"`,
    process.cwd(),
  );
};

const copyToRemote = (env: DeployEnv, projectDir: string): void => {
  const distDir = (env.DIST_DIR || "dist").replace(/\/+$/, "");
  const isStaticSite = env.STATIC_SITE === "true";
  const destination = `${env.DEPLOY_USER}@${env.DEPLOY_HOST}:${env.DEPLOY_PATH}/`;

  log("Copying files to remote server...");

  if (isStaticSite) {
    // Static assets are served directly from DEPLOY_PATH, so copy the
    // *contents* of the dist dir rather than the dist dir itself.
    run(`scp -r ${distDir}/* ${destination}`, projectDir);
    return;
  }

  // Source mode: ship the listed project-relative directories as-is instead
  // of a single pre-built DIST_DIR, so Bun runs the TypeScript source
  // directly on the remote host (no local bundle to go stale or embed the
  // build machine's own paths into anything, e.g. Prisma's generated client).
  const sourceDirs = env.SOURCE_DIRS
    ? env.SOURCE_DIRS.split(",").map((d) => d.trim()).filter(Boolean)
    : null;

  // For app deployments, copy either the source directories or the dist
  // directory itself (preserving the folder) plus package.json and a
  // lockfile, so PM2's entry file path and `bun install` both resolve
  // correctly on the remote side.
  const sources = [...(sourceDirs ?? [distDir]), "package.json"];

  const lockfile = findLocalLockfile(projectDir);
  if (lockfile) sources.push(lockfile);
  else
    log(
      "⚠ No lockfile found locally (bun.lockb / bun.lock / package-lock.json) — skipping",
    );

  if (env.SERVER_FILE && existsSync(path.join(projectDir, env.SERVER_FILE))) {
    sources.push(env.SERVER_FILE);
  }

  run(`scp -r ${sources.join(" ")} ${destination}`, projectDir);
};

// Follows Bun's official PM2 guide (https://bun.com/guides/ecosystem/pm2):
// a pm2.config.cjs with name/script/interpreter/env.PATH, started via
// `pm2 start pm2.config.cjs`, rather than passing --interpreter/--env as CLI
// flags. `PATH` is written as a literal JS template expression (not
// interpolated here) so it's evaluated by Node on the REMOTE host when PM2
// loads the config — i.e. it resolves the remote user's own $HOME/.bun/bin,
// not whatever this deploy script's own machine has. This makes `bun` on
// PATH self-contained in the process definition PM2 persists via `pm2 save`,
// independent of the shell that happened to start it.
const generatePm2ConfigContent = (
  appName: string,
  entryFile: string,
  env: DeployEnv,
): string => {
  const envLines = ['    PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`,'];
  if (env.PORT) envLines.push(`    PORT: "${env.PORT}",`);

  return [
    "module.exports = {",
    `  name: "${appName}",`,
    `  script: "${entryFile}",`,
    '  interpreter: "bun",',
    "  env: {",
    ...envLines,
    "  },",
    "};",
    "",
  ].join("\n");
};

// Writes pm2.config.cjs to a local throwaway temp file, scps it to the
// remote deploy path (as `pm2.config.cjs`, regardless of the local temp
// file's own name), then deletes the local copy. Must run after cleanRemote
// (which wipes DEPLOY_PATH down to `.env`) and needs to happen on every
// deploy, not just once, since that clean step would otherwise delete it.
const copyPm2Config = (
  env: DeployEnv,
  appName: string,
  entryFile: string,
  projectDir: string,
): void => {
  const tmpPath = path.join(projectDir, "pm2.config.cjs.deploy-tmp");
  writeFileSync(tmpPath, generatePm2ConfigContent(appName, entryFile, env));
  try {
    run(
      `scp "${tmpPath}" ${env.DEPLOY_USER}@${env.DEPLOY_HOST}:'${env.DEPLOY_PATH}/pm2.config.cjs'`,
      projectDir,
    );
  } finally {
    unlinkSync(tmpPath);
  }
};

const restartRemote = (env: DeployEnv, projectDir: string): void => {
  const distDir = (env.DIST_DIR || "dist").replace(/\/+$/, "");
  const isSourceMode = !!env.SOURCE_DIRS;
  const entryFile =
    env.SERVER_FILE || (isSourceMode ? "src/index.ts" : `${distDir}/index.js`);
  // Non-null: restartRemote only runs for non-static-site deploys, and
  // validate() already requires APP_NAME in that case.
  const appName = env.APP_NAME as string;

  copyPm2Config(env, appName, entryFile, projectDir);

  const steps = [`cd '${env.DEPLOY_PATH}'`, "bun install --production"];

  // Generate the Prisma Client on the remote host itself, if a schema path
  // was given, so its native query engine always matches that host's own
  // platform instead of being cross-shipped from wherever the app was built.
  if (env.PRISMA_SCHEMA) {
    steps.push(
      `if [ -f ${env.PRISMA_SCHEMA} ]; then bunx prisma generate --schema=${env.PRISMA_SCHEMA}; fi`,
    );

    // Opt-in only: some projects don't treat prisma/migrations as the
    // source of truth for applied migrations (e.g. they apply schema
    // changes through other tooling and keep the migrations folder purely
    // for documentation), so `migrate deploy` must not run for those.
    if (env.RUN_MIGRATIONS === "true") {
      steps.push(
        `if [ -f ${env.PRISMA_SCHEMA} ]; then bunx prisma migrate deploy --schema=${env.PRISMA_SCHEMA}; fi`,
      );
    }
  }

  // Always delete-then-start rather than restart, so PM2 can never keep an
  // app running under the wrong interpreter (e.g. node) from a prior manual
  // or partial deploy. This guarantees Bun is used every time.
  steps.push(`pm2 delete ${appName} >/dev/null 2>&1 || true`);
  steps.push("pm2 start pm2.config.cjs --update-env");
  steps.push("pm2 save");

  const remoteCmd = steps.join(" && ");
  log("Installing dependencies and restarting via PM2 (Bun interpreter)...");
  run(
    `ssh ${env.DEPLOY_USER}@${env.DEPLOY_HOST} "zsh -i -c '${remoteCmd}'"`,
    projectDir,
  );
};

// Main deploy function
export const deploy = (config: DeployConfig = {}): void => {
  const projectDir = config.projectDir || process.cwd();
  const envFile = config.envFile || ".env";
  const env = config.env || loadEnv(projectDir, envFile);
  validate(env);

  const isStaticSite = env.STATIC_SITE === "true";

  console.log(`\nDeploying to ${env.DEPLOY_HOST}:${env.DEPLOY_PATH}\n`);

  try {
    if (!config.skipBuild) {
      buildLocal(env, projectDir);
    } else {
      log("Skipping build (--skip-build flag set)");
    }

    cleanRemote(env);
    copyToRemote(env, projectDir);

    if (!isStaticSite) {
      restartRemote(env, projectDir);
    } else {
      log("Static site deployment (skipping bun install and PM2)");
    }

    log("✓ Deployment complete!");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log(`✗ Deployment failed: ${message}`);
    process.exit(1);
  }
};

// CLI entry point - execute if called directly as a script
if (process.argv[1]?.includes("deploy.ts")) {
  const skipBuild = process.argv.includes("--skip-build");
  const envFileArg = process.argv.find((arg) => arg.startsWith("--env-file="));
  const envFile = envFileArg ? envFileArg.split("=")[1] : undefined;
  deploy({ skipBuild, envFile });
}
