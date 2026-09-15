import { execSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  HOOKS_DIR,
  HOOKS_PATH_COMMAND,
  PRE_COMMIT_HOOK_NAME,
} from "./git-hooks.constants";
import type { PackageJson } from "./git-hooks.types";
import {
  buildPreCommitHook,
  detectPackageManager,
  isTypeScriptProject,
  readPackageJson,
} from "./git-hooks.utils";

function setupGitHooks(
  projectPath: string,
  options: { force?: boolean } = {},
): void {
  if (!existsSync(path.join(projectPath, ".git"))) {
    console.error(`❌ Not a git repository (no .git found): ${projectPath}`);
    process.exit(1);
  }

  let pkg: PackageJson;
  try {
    pkg = readPackageJson(projectPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      console.error(`❌ package.json not found in: ${projectPath}`);
    } else {
      console.error(`❌ Invalid package.json in: ${projectPath}`);
    }
    process.exit(1);
  }

  const hooksDir = path.join(projectPath, HOOKS_DIR);
  const hookPath = path.join(hooksDir, PRE_COMMIT_HOOK_NAME);

  if (existsSync(hookPath) && !options.force) {
    console.error(
      `❌ ${hookPath} already exists. Pass --force to overwrite it.`,
    );
    process.exit(1);
  }

  const manager = detectPackageManager(projectPath);
  const isTypeScript = isTypeScriptProject(projectPath, pkg);

  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(hookPath, buildPreCommitHook(pkg, manager, isTypeScript));
  try {
    chmodSync(hookPath, 0o755);
  } catch {
    // Best-effort: irrelevant on filesystems without POSIX permission bits (e.g. some
    // Windows setups) - Git for Windows still runs the hook via its shebang line.
  }

  execSync(HOOKS_PATH_COMMAND, { cwd: projectPath, stdio: "inherit" });

  if (!pkg.scripts) pkg.scripts = {};
  if (pkg.scripts["prepare"] !== HOOKS_PATH_COMMAND) {
    pkg.scripts["prepare"] = HOOKS_PATH_COMMAND;
    writeFileSync(
      path.join(projectPath, "package.json"),
      `${JSON.stringify(pkg, null, 2)}\n`,
    );
    console.log(`✏️  Added "prepare" → "${HOOKS_PATH_COMMAND}" to package.json`);
  }

  console.log(
    `✅ Wrote ${hookPath} and set core.hooksPath (package manager: ${manager}${isTypeScript ? ", TypeScript" : ""})`,
  );
  console.log(`
Every contributor gets this hook automatically: the "prepare" script re-runs
"${HOOKS_PATH_COMMAND}" on their next install, since ${HOOKS_DIR}/ is tracked in git.
`);
}

const projectPath =
  process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : process.cwd();
const force = process.argv.includes("--force");

if (process.argv.includes("--help")) {
  console.log(`
Usage: git-hooks.ts [projectPath] [options]

Generates .githooks/pre-commit (running lint/typecheck/test) and points
git's core.hooksPath at it, so the hook is version-controlled and shared
with every contributor instead of living only in the untracked .git/hooks/.

Options:
  --force       Overwrite an existing hook file
  --help        Show this help message

Examples:
  bun scripts/git-hooks/git-hooks.ts
  bun scripts/git-hooks/git-hooks.ts ./some-project
  bun scripts/git-hooks/git-hooks.ts --force
`);
  process.exit(0);
}

setupGitHooks(projectPath, { force });
