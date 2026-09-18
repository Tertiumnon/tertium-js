#!/usr/bin/env node
import { execFileSync, execSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import * as path from "node:path";
import type { DeployConfig, DeployEnv } from "./deploy.types";

const LOCKFILE_CANDIDATES = ["bun.lockb", "bun.lock", "package-lock.json"];

const log = (message: string): void => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

// For BUILD_COMMAND only: an arbitrary user-configured shell command (may
// use &&, env vars, etc.), so it genuinely needs a shell to interpret it.
const run = (command: string, cwd: string): void => {
  console.log(`→ ${command}`);
  // Note: stdio: "inherit" requires object-style options, but TypeScript's
  // ExecSyncOptions type doesn't properly support this combination.
  // biome-ignore lint/suspicious/noExplicitAny: Node.js types limitation
  execSync(command, { stdio: "inherit", cwd, shell: true } as any);
};

// For ssh/scp: no shell at all, so argv reaches the process exactly as
// built here regardless of the local OS/shell. `run()`'s `shell: true` was
// wrong for these — on Windows it resolves to whatever `execSync` picks
// (cmd.exe, unless the SHELL env var happens to point at a POSIX shell, as
// Git Bash sets but PowerShell/cmd don't), and cmd.exe doesn't strip the
// single quotes this file wraps remote paths in, corrupting them. Local
// glob patterns (e.g. `dist/*`) also won't expand without a shell — tar's
// own `-C dir .` (see `archiveAndCopyToRemote`) sidesteps this entirely.
const runArgv = (cmd: string, args: string[], cwd: string): void => {
  console.log(`→ ${cmd} ${args.join(" ")}`);
  // biome-ignore lint/suspicious/noExplicitAny: Node.js types limitation
  execFileSync(cmd, args, { stdio: "inherit", cwd } as any);
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
  // The single quotes here are for the REMOTE shell (whatever runs this
  // string on DEPLOY_HOST when ssh forwards it) — unaffected by the local
  // OS/shell, since the whole string is one argv element passed to ssh.
  const remoteCmd =
    `mkdir -p '${env.DEPLOY_PATH}' && cd '${env.DEPLOY_PATH}' && ` +
    `find . -mindepth 1 -maxdepth 1 ! -name '.env' -exec rm -rf {} +`;
  runArgv(
    "ssh",
    [`${env.DEPLOY_USER}@${env.DEPLOY_HOST}`, remoteCmd],
    process.cwd(),
  );
};

// True when `member` (a project-relative path) is already inside one of
// `dirs` (also project-relative), so callers don't ship it a second time.
const isInsideAnyDir = (member: string, dirs: string[]): boolean =>
  dirs.some((dir) => {
    const rel = path.relative(dir, member);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });

// Resolves what to ship for a non-static deploy: either the listed source
// directories (source mode) or the single built DIST_DIR, plus package.json,
// a lockfile, and SERVER_FILE if it lives outside all of those already (e.g.
// a standalone entry file at the project root, not inside dist/ or src/).
const resolveAppMembers = (env: DeployEnv, projectDir: string): string[] => {
  const distDir = (env.DIST_DIR || "dist").replace(/\/+$/, "");
  const sourceDirs = env.SOURCE_DIRS
    ? env.SOURCE_DIRS.split(",")
        .map((d) => d.trim())
        .filter(Boolean)
    : null;
  const dirs = sourceDirs ?? [distDir];

  const members = [...dirs, "package.json"];

  const lockfile = findLocalLockfile(projectDir);
  if (lockfile) members.push(lockfile);
  else
    log(
      "⚠ No lockfile found locally (bun.lockb / bun.lock / package-lock.json) — skipping",
    );

  if (
    env.SERVER_FILE &&
    existsSync(path.join(projectDir, env.SERVER_FILE)) &&
    !isInsideAnyDir(env.SERVER_FILE, dirs)
  ) {
    members.push(env.SERVER_FILE);
  }

  return members;
};

const ARCHIVE_FILE_NAME = "deploy-archive.tar.gz.deploy-tmp";

// Ships everything in one tar.gz over one scp connection instead of a
// separate transfer per top-level item - meaningfully faster than plain scp
// once a directory holds more than a handful of files (each file is its own
// round-trip under scp -r), and it's what every deploy target already has:
// tar ships with macOS/Linux, and modern Windows for local archive creation.
//
// Every path handed to `tar`/`scp` here is relative, with `cwd` doing the
// resolution (via execFileSync's option, a plain Node chdir - not a tar/scp
// argument). Windows' tar/scp both misparse an absolute "D:\..." argument as
// remote "host:path" syntax (the colon after a drive letter looks exactly
// like scp's user@host: convention), so this file can never pass one of
// those tools an absolute local path as an argv element - only cwd.
//
// Safety: cleanRemote() already wiped DEPLOY_PATH down to just `.env` before
// this runs, and extraction only ever *adds* files - it never deletes what's
// already there. So as long as `.env` never ends up as a tar member (it
// isn't one of DIST_DIR/SOURCE_DIRS/package.json/lockfile/pm2.config.cjs in
// any normal project layout), the remote `.env` bootstrapped once per
// deploy target survives every redeploy untouched.
const archiveAndCopyToRemote = (
  env: DeployEnv,
  projectDir: string,
  pm2ConfigDir: string | null,
): void => {
  const distDir = (env.DIST_DIR || "dist").replace(/\/+$/, "");
  const isStaticSite = env.STATIC_SITE === "true";
  // Static sites archive from inside distDir itself (see below); everything
  // else archives from projectDir.
  const archiveCwd = isStaticSite ? path.join(projectDir, distDir) : projectDir;

  log("Archiving files for transfer...");

  if (isStaticSite) {
    // Static assets are served directly from DEPLOY_PATH, so archive the
    // *contents* of the dist dir rather than the dist dir itself - cwd is
    // already distDir, so "." captures exactly that.
    runArgv("tar", ["-czf", ARCHIVE_FILE_NAME, "."], archiveCwd);
  } else {
    const tarArgs = [
      "-czf",
      ARCHIVE_FILE_NAME,
      ...resolveAppMembers(env, projectDir),
    ];
    // pm2.config.cjs is generated fresh into its own throwaway staging
    // subdirectory of projectDir (see stagePm2Config), so it can be named
    // exactly "pm2.config.cjs" here without ever risking clobbering a real
    // file a project might already have at that path. A second `-C` mid-argv
    // is standard tar behavior (GNU and macOS/BSD tar both support it):
    // later members resolve against the most recent `-C` seen so far - given
    // relative to projectDir here (same reasoning as above re: no absolute
    // paths), not to the tar process's original cwd.
    if (pm2ConfigDir) {
      tarArgs.push(
        "-C",
        path.relative(projectDir, pm2ConfigDir),
        "pm2.config.cjs",
      );
    }
    runArgv("tar", tarArgs, archiveCwd);
  }

  const localArchivePath = path.join(archiveCwd, ARCHIVE_FILE_NAME);
  const remoteArchivePath = `${env.DEPLOY_PATH}/${ARCHIVE_FILE_NAME}`;
  try {
    log("Copying archive to remote server...");
    runArgv(
      "scp",
      [
        ARCHIVE_FILE_NAME,
        `${env.DEPLOY_USER}@${env.DEPLOY_HOST}:${remoteArchivePath}`,
      ],
      archiveCwd,
    );
  } finally {
    unlinkSync(localArchivePath);
  }

  log("Extracting archive on remote server...");
  runArgv(
    "ssh",
    [
      `${env.DEPLOY_USER}@${env.DEPLOY_HOST}`,
      `tar -xzf '${remoteArchivePath}' -C '${env.DEPLOY_PATH}' && rm '${remoteArchivePath}'`,
    ],
    projectDir,
  );
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
//
// The guide's own PATH expression (`${HOME}/.bun/bin:${PATH}`) blindly
// prepends without checking whether it's already there. On a host whose
// shell profile also puts bun on PATH (common — `.zshrc`/`.bashrc` after a
// standard bun install), every redeploy re-evaluates this expression against
// a PATH that already has the entry, so it silently grows by one duplicate
// per deploy forever. Deduplicating at generation time makes the config
// idempotent regardless of how many times it's regenerated.
const generatePm2ConfigContent = (
  appName: string,
  entryFile: string,
  env: DeployEnv,
): string => {
  const envLines = [
    // biome-ignore lint/suspicious/noTemplateCurlyInString: literal JS evaluated on the remote host, per the comment above - not meant to be interpolated here.
    '    PATH: [...new Set(`${process.env.HOME}/.bun/bin:${process.env.PATH}`.split(":"))].join(":"),',
  ];
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

// Writes pm2.config.cjs into a fresh, randomly-named staging subdirectory of
// projectDir (never projectDir itself, so the file can be named exactly
// "pm2.config.cjs" without ever risking clobbering a real file a project
// might already have at that path). Created inside projectDir rather than
// the OS temp dir specifically so archiveAndCopyToRemote() can reference it
// with a path relative to projectDir - see the note there on why this file
// never hands tar/scp an absolute local path. Regenerated on every deploy
// (not just once), since cleanRemote() wipes DEPLOY_PATH down to `.env` first.
const stagePm2Config = (
  projectDir: string,
  env: DeployEnv,
  appName: string,
  entryFile: string,
): string => {
  const stagingDir = mkdtempSync(path.join(projectDir, ".deploy-pm2-"));
  writeFileSync(
    path.join(stagingDir, "pm2.config.cjs"),
    generatePm2ConfigContent(appName, entryFile, env),
  );
  return stagingDir;
};

const restartRemote = (env: DeployEnv, projectDir: string): void => {
  // Non-null: restartRemote only runs for non-static-site deploys, and
  // validate() already requires APP_NAME in that case.
  const appName = env.APP_NAME as string;

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
  // or partial deploy. This guarantees Bun is used every time. Since the app
  // is always freshly deleted first, `--update-env` (for refreshing a
  // still-running process's env) would be redundant — `pm2 start` always
  // reads pm2.config.cjs fresh here regardless.
  steps.push(`pm2 delete ${appName} >/dev/null 2>&1 || true`);
  steps.push("pm2 start pm2.config.cjs");
  steps.push("pm2 save");

  const remoteCmd = steps.join(" && ");
  log("Installing dependencies and restarting via PM2 (Bun interpreter)...");
  runArgv(
    "ssh",
    [`${env.DEPLOY_USER}@${env.DEPLOY_HOST}`, `zsh -i -c '${remoteCmd}'`],
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
  const distDir = (env.DIST_DIR || "dist").replace(/\/+$/, "");
  const isSourceMode = !!env.SOURCE_DIRS;
  const entryFile =
    env.SERVER_FILE || (isSourceMode ? "src/index.ts" : `${distDir}/index.js`);

  console.log(`\nDeploying to ${env.DEPLOY_HOST}:${env.DEPLOY_PATH}\n`);

  let pm2ConfigDir: string | null = null;
  try {
    if (!config.skipBuild) {
      buildLocal(env, projectDir);
    } else {
      log("Skipping build (--skip-build flag set)");
    }

    cleanRemote(env);

    if (!isStaticSite) {
      // Non-null: validate() already requires APP_NAME for non-static sites.
      pm2ConfigDir = stagePm2Config(
        projectDir,
        env,
        env.APP_NAME as string,
        entryFile,
      );
    }
    archiveAndCopyToRemote(env, projectDir, pm2ConfigDir);

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
  } finally {
    if (pm2ConfigDir) rmSync(pm2ConfigDir, { recursive: true, force: true });
  }
};

// CLI entry point - execute if called directly as a script
if (process.argv[1]?.includes("deploy.ts")) {
  const skipBuild = process.argv.includes("--skip-build");
  const envFileArg = process.argv.find((arg) => arg.startsWith("--env-file="));
  const envFile = envFileArg ? envFileArg.split("=")[1] : undefined;
  deploy({ skipBuild, envFile });
}
