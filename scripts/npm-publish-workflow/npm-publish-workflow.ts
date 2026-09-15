import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PackageJson } from "./npm-publish-workflow.types";
import {
  buildWorkflowYaml,
  detectPackageManager,
  isTypeScriptProject,
  readPackageJson,
} from "./npm-publish-workflow.utils";

function setupPublishWorkflow(
  projectPath: string,
  options: { force?: boolean } = {},
): void {
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

  if (pkg.private) {
    console.error(
      `❌ ${pkg.name ?? "This package"} is marked "private": true - trusted publishing ` +
        "doesn't apply to packages that are never published. Remove `private` first, or " +
        "pass --force to generate the workflow anyway.",
    );
    if (!options.force) process.exit(1);
  }

  const manager = detectPackageManager(projectPath);
  const workflowDir = path.join(projectPath, ".github", "workflows");
  const workflowPath = path.join(workflowDir, "publish.yml");

  if (existsSync(workflowPath) && !options.force) {
    console.error(
      `❌ ${workflowPath} already exists. Pass --force to overwrite it.`,
    );
    process.exit(1);
  }

  const isTypeScript = isTypeScriptProject(projectPath, pkg);

  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(workflowPath, buildWorkflowYaml(pkg, manager, isTypeScript));

  console.log(
    `✅ Wrote ${workflowPath} (package manager: ${manager}${isTypeScript ? ", TypeScript" : ""})`,
  );
  console.log(`
📋 One-time setup still required on npmjs.com before this works:
   1. Go to https://www.npmjs.com/package/${pkg.name ?? "<your-package>"}/access
   2. Under "Trusted Publisher", add a GitHub Actions publisher:
      - Organization or user: <your GitHub org/user>
      - Repository: <this repo's name>
      - Workflow filename: publish.yml
      - Environment name: (leave blank unless you added one)
   3. No NPM_TOKEN secret is needed - the workflow authenticates via OIDC.

Trigger: push a "v*" tag (e.g. \`npm version patch && git push --tags\`) or run the workflow manually.
`);
}

const projectPath =
  process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : process.cwd();
const force = process.argv.includes("--force");

if (process.argv.includes("--help")) {
  console.log(`
Usage: npm-publish-workflow.ts [projectPath] [options]

Generates .github/workflows/publish.yml, which publishes the package to npm
via trusted publishing (OIDC) whenever a "v*" tag is pushed. See:
https://docs.npmjs.com/trusted-publishers

Options:
  --force       Overwrite an existing workflow file, or proceed for a private package
  --help        Show this help message

Examples:
  bun scripts/npm-publish-workflow/npm-publish-workflow.ts
  bun scripts/npm-publish-workflow/npm-publish-workflow.ts ./some-project
  bun scripts/npm-publish-workflow/npm-publish-workflow.ts --force
`);
  process.exit(0);
}

setupPublishWorkflow(projectPath, { force });
