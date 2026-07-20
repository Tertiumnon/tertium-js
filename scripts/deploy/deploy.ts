#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

export interface DeployConfig {
  projectDir?: string;
  env?: Record<string, string>;
  skipBuild?: boolean;
}

const LOCKFILE_CANDIDATES = ["bun.lockb", "bun.lock", "package-lock.json"];

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function run(command: string, cwd: string): void {
  console.log(`→ ${command}`);
  execSync(command, { stdio: "inherit", cwd, shell: true } as any);
}

// Load .env file
export function loadEnv(projectDir: string): Record<string, string> {
  const envPath = path.join(projectDir, ".env");
  if (!existsSync(envPath)) {
    console.error("Error: .env file not found");
    console.error(`Please copy .env.example to .env in ${projectDir}`);
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

  return env;
}

// Validate environment variables
export function validate(env: Record<string, string>) {
  const required = ["DEPLOY_USER", "DEPLOY_HOST", "DEPLOY_PATH"];
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    console.error(`Error: Missing environment variables: ${missing.join(", ")}`);
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
    console.error("Error: APP_NAME is required for non-static site deployments");
    process.exit(1);
  }
}

function findLocalLockfile(projectDir: string): string | null {
  for (const candidate of LOCKFILE_CANDIDATES) {
    if (existsSync(path.join(projectDir, candidate))) return candidate;
  }
  return null;
}

function buildLocal(env: Record<string, string>, projectDir: string): void {
  const buildCommand = env.BUILD_COMMAND || "bun run build";
  log("Building application locally...");
  run(buildCommand, projectDir);
}

// Remove everything under DEPLOY_PATH except .env, so stale files (old
// package.json, mismatched lockfiles, old builds) can never linger between
// deployments. Creates DEPLOY_PATH first in case this is the first deploy.
function cleanRemote(env: Record<string, string>): void {
  log(`Cleaning remote directory (preserving .env): ${env.DEPLOY_PATH}`);
  const remoteCmd =
    `mkdir -p '${env.DEPLOY_PATH}' && cd '${env.DEPLOY_PATH}' && ` +
    `find . -mindepth 1 -maxdepth 1 ! -name '.env' -exec rm -rf {} +`;
  run(`ssh ${env.DEPLOY_USER}@${env.DEPLOY_HOST} "${remoteCmd}"`, process.cwd());
}

function copyToRemote(env: Record<string, string>, projectDir: string): void {
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

  // For app deployments, copy the dist directory itself (preserving the
  // folder) plus package.json and a lockfile, so PM2's `${distDir}/index.js`
  // path and `bun install` both resolve correctly on the remote side.
  const sources = [distDir, "package.json"];

  const lockfile = findLocalLockfile(projectDir);
  if (lockfile) sources.push(lockfile);
  else log("⚠ No lockfile found locally (bun.lockb / bun.lock / package-lock.json) — skipping");

  if (env.SERVER_FILE && existsSync(path.join(projectDir, env.SERVER_FILE))) {
    sources.push(env.SERVER_FILE);
  }

  run(`scp -r ${sources.join(" ")} ${destination}`, projectDir);
}

function restartRemote(env: Record<string, string>, projectDir: string): void {
  const distDir = (env.DIST_DIR || "dist").replace(/\/+$/, "");
  const entryFile = env.SERVER_FILE || `${distDir}/index.js`;
  const appName = env.APP_NAME;
  const portOpt = env.PORT ? ` --env PORT=${env.PORT}` : "";

  const steps = [
    `cd '${env.DEPLOY_PATH}'`,
    "bun install --production",
  ];

  // Optional Prisma generation, if the build produced a schema.
  steps.push(
    `if [ -f ${distDir}/src/db/schema.prisma ]; then bunx prisma generate --schema=${distDir}/src/db/schema.prisma; fi`,
  );

  // Always delete-then-start rather than restart, so PM2 can never keep an
  // app running under the wrong interpreter (e.g. node) from a prior manual
  // or partial deploy. This guarantees Bun is used every time.
  steps.push(`pm2 delete ${appName} >/dev/null 2>&1 || true`);
  steps.push(`pm2 start ${entryFile} --name ${appName} --interpreter bun --update-env${portOpt}`);
  steps.push("pm2 save");

  const remoteCmd = steps.join(" && ");
  log("Installing dependencies and restarting via PM2 (Bun interpreter)...");
  run(`ssh ${env.DEPLOY_USER}@${env.DEPLOY_HOST} "zsh -i -c '${remoteCmd}'"`, projectDir);
}

// Main deploy function
export function deploy(config: DeployConfig = {}): void {
  const projectDir = config.projectDir || process.cwd();
  const env = config.env || loadEnv(projectDir);
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
  } catch (error: any) {
    log(`✗ Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

// CLI entry point - execute if called directly as a script
if (process.argv[1]?.includes("deploy.ts")) {
  const skipBuild = process.argv.includes("--skip-build");
  deploy({ skipBuild });
}
