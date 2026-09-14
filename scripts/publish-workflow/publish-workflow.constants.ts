import type { PackageManager } from "./publish-workflow.types";

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

export const INSTALL_COMMAND: Record<PackageManager, string> = {
  bun: "bun install --frozen-lockfile",
  pnpm: "pnpm install --frozen-lockfile",
  yarn: "yarn install --frozen-lockfile",
  npm: "npm ci",
};

export const RUN_PREFIX: Record<PackageManager, string> = {
  bun: "bun run",
  pnpm: "pnpm run",
  yarn: "yarn",
  npm: "npm run",
};

// Trusted publishing (OIDC) is an npm CLI feature, so the publish step always
// runs through `npm publish` regardless of which package manager built/tested
// the project - only the install/build/test steps use the detected tool.
export const TOOLCHAIN_SETUP_STEP: Record<PackageManager, string> = {
  bun: "      - name: Setup Bun\n        uses: oven-sh/setup-bun@v2\n\n",
  pnpm: "      - name: Setup pnpm\n        uses: pnpm/action-setup@v6\n\n",
  yarn: "",
  npm: "",
};
