import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { createInterface } from "node:readline";
import type { DeploymentConfig } from "./azure-deployment-pipeline.types";
import { buildDeploymentYaml } from "./azure-deployment-pipeline.utils";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string, defaultValue?: string): Promise<string> {
  return new Promise((resolve) => {
    const displayQuestion = defaultValue
      ? `${question} [${defaultValue}] `
      : `${question} `;
    rl.question(displayQuestion, (answer) => {
      resolve(answer || defaultValue || "");
    });
  });
}

function loadEnvFile(
  projectPath: string,
  environment: string,
): Record<string, string> {
  // Try environment-specific .env file first (.env.prod, .env.staging, etc.)
  const envPath = path.join(projectPath, `.env.${environment}`);
  const fallbackEnvPath = path.join(projectPath, ".env");
  const env: Record<string, string> = {};

  const fileToRead = existsSync(envPath) ? envPath : fallbackEnvPath;

  if (existsSync(fileToRead)) {
    const content = readFileSync(fileToRead, "utf-8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key) {
          env[key.trim()] = valueParts.join("=").trim();
        }
      }
    });
  }

  return env;
}

async function setupDeploymentPipeline(
  projectPath: string,
  options: { force?: boolean } = {},
): Promise<void> {
  console.log(`
🚀 Azure Deployment Pipeline Setup
====================================
`);

  // Get project name from directory first
  const dirName = path.basename(path.resolve(projectPath));
  const projectName = await prompt("Project name:", dirName);

  // Ask for environment first so we can load the right .env file
  console.log(`\nEnvironment options: production, staging, development`);
  const environment = await prompt("Target environment:", "production");

  // Load environment-specific .env file (.env.prod, .env.staging, etc.)
  const envVars = loadEnvFile(projectPath, environment);

  // Override project name if set in .env
  const finalProjectName = envVars["PROJECT_NAME"] || projectName;

  // Check for Prisma support
  const defaultHasPrisma =
    envVars["USE_PRISMA"]?.toLowerCase() === "true" ||
    envVars["USE_PRISMA"]?.toLowerCase() === "yes"
      ? "yes"
      : "no";
  const hasPrismaStr = await prompt(
    "Does this project use Prisma? (yes/no):",
    defaultHasPrisma,
  );
  const hasPrisma = hasPrismaStr.toLowerCase().startsWith("y");

  // SSH endpoint from .env or derive
  const defaultSshEndpoint =
    envVars["AZURE_SSH_ENDPOINT"] || `${finalProjectName}-${environment}-ssh`;
  const sshEndpoint = await prompt(
    "SSH service connection name:",
    defaultSshEndpoint,
  );

  // Deploy path from .env or derive
  const defaultDeployPath =
    envVars["DEPLOY_PATH"] || `/var/www/${finalProjectName}`;
  const deployPath = await prompt(
    "Deploy path on production server:",
    defaultDeployPath,
  );

  // PM2 app name is always derived from PROJECT_NAME
  const appName = hasPrisma ? finalProjectName : undefined;

  const config: DeploymentConfig = {
    projectName: finalProjectName,
    environment,
    deployPath,
    sshEndpoint,
    hasPrisma,
    appName,
  };

  const pipelineDir = projectPath;
  const pipelinePath = path.join(pipelineDir, "azure-pipelines.yml");

  if (existsSync(pipelinePath) && !options.force) {
    console.error(
      `\n❌ ${pipelinePath} already exists. Pass --force to overwrite it.`,
    );
    rl.close();
    process.exit(1);
  }

  const yaml = buildDeploymentYaml(config);
  writeFileSync(pipelinePath, yaml);

  console.log(`
✅ Wrote ${pipelinePath}

📋 Configuration loaded:
   - Project: ${config.projectName}
   - Environment: ${config.environment}
   - SSH endpoint: ${config.sshEndpoint}
   - Deploy path: ${config.deployPath}
   - App name: ${config.appName || "(static site)"}
   - Prisma: ${config.hasPrisma ? "yes" : "no"}

📌 One-time setup required:

   1. In Azure DevOps project settings:
      - Project Settings → Service connections
      - New SSH connection named: ${config.sshEndpoint}
      - Host: (your production server)
      - Port: 22
      - Username: (deployment user)
      - Private key: (paste your SSH private key in PEM format)

   2. On production server:
      cd ${config.deployPath}
      # Ensure git clone of your repository
      git clone <repo-url> .

      # Create .env file with credentials
      cat > .env <<'EOF'
      DATABASE_URL="..."
      JWT_SECRET="..."
      EOF

      # Add pipeline SSH public key to authorized_keys
      cat >> ~/.ssh/authorized_keys <<'EOF'
      <your pipeline SSH public key>
      EOF

🚀 To deploy:
   npm run release:patch   # bumps version and pushes tag v*
   # Pipeline triggers automatically on v* tag push
`);

  rl.close();
}

const projectPath =
  process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : process.cwd();
const force = process.argv.includes("--force");

if (process.argv.includes("--help")) {
  console.log(`
Usage: azure-deployment-pipeline.ts [projectPath] [options]

Generates azure-pipelines.yml for production deployment via Azure Pipelines SSH.
Prompts for configuration details and derives defaults from project name.

Arguments:
  projectPath   Root of the repository (default: current directory)

Options:
  --force       Overwrite an existing azure-pipelines.yml
  --help        Show this help message

Examples:
  bun scripts/azure-deployment-pipeline/azure-deployment-pipeline.ts
  bun scripts/azure-deployment-pipeline/azure-deployment-pipeline.ts ~/path/to/project
  bun scripts/azure-deployment-pipeline/azure-deployment-pipeline.ts . --force
`);
  process.exit(0);
}

setupDeploymentPipeline(projectPath, { force }).catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
