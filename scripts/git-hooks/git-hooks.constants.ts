import type { PackageManager } from "./git-hooks.types";

export const LOCKFILE_MANAGERS: Array<{
  file: string;
  manager: PackageManager;
}> = [
  { file: "bun.lock", manager: "bun" },
  { file: "bun.lockb", manager: "bun" },
  { file: "pnpm-lock.yaml", manager: "pnpm" },
  { file: "yarn.lock", manager: "yarn" },
  { file: "package-lock.json", manager: "npm" },
];

export const RUN_PREFIX: Record<PackageManager, string> = {
  bun: "bun run",
  pnpm: "pnpm run",
  yarn: "yarn",
  npm: "npm run",
};

// Tracked (committed) hooks directory, wired up via `git config core.hooksPath`, so the
// hook ships with the repo instead of living only in the untracked .git/hooks/ folder.
export const HOOKS_DIR = ".githooks";
export const PRE_COMMIT_HOOK_NAME = "pre-commit";
export const HOOKS_PATH_COMMAND = `git config core.hooksPath ${HOOKS_DIR}`;
