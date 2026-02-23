#!/usr/bin/env bun

/**
 * Deploy Wrapper Script
 * Usage: bun ./node_modules/@tertium/js/app/scripts/deploy/run.ts <config-path> [--skip-build]
 *
 * The config file should be a TypeScript file that exports a default DeployConfig object.
 * Example config file (deploy.config.ts):
 *
 * import type { DeployConfig } from "@tertium/js/app/scripts/deploy";
 *
 * export default {
 *   remoteHost: "tertium",
 *   deployPath: "/var/www/my-app",
 *   appName: "my-app",
 *   localDist: "./dist",
 *   tempPath: "/tmp/my-app-deploy",
 *   envFile: ".env"
 * } satisfies DeployConfig;
 */

import { createDeployService } from "./index";
import type { DeployConfig } from "./deploy.types";

const args = Bun.argv.slice(2);
const configPath = args[0];
const skipBuild = args.includes("--skip-build");

if (!configPath) {
  console.error("❌ Usage: bun run.ts <config-path> [--skip-build]");
  console.error("   Example: bun run.ts ../my-app/deploy.config.ts");
  process.exit(1);
}

try {
  const configModule = await import(`file://${process.cwd()}/${configPath}`);
  const config: DeployConfig = configModule.default;

  const deployer = await createDeployService(config, { skipBuild });
  const result = await deployer.deploy();

  process.exit(result.success ? 0 : 1);
} catch (error) {
  console.error(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exit(1);
}
