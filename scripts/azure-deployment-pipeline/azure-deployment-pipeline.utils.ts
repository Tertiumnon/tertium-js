import {
  DEPLOYMENT_COMMANDS,
  SSH_COMMAND_BASE,
} from "./azure-deployment-pipeline.constants";
import type { DeploymentConfig } from "./azure-deployment-pipeline.types";

export function buildSshCommands(config: DeploymentConfig): string[] {
  const commands: string[] = [];

  // 1. Navigate to deploy directory
  commands.push(`cd ${config.deployPath}`);

  // 2. Sync with git
  commands.push(DEPLOYMENT_COMMANDS.gitSync);

  // 3. Source environment variables
  commands.push(DEPLOYMENT_COMMANDS.envSource);

  // 4. Install dependencies
  commands.push(DEPLOYMENT_COMMANDS.bunInstall(config.hasPrisma));

  // 5. Prisma setup (backend only)
  if (config.hasPrisma) {
    commands.push(DEPLOYMENT_COMMANDS.prismaGenerate);
    commands.push(DEPLOYMENT_COMMANDS.prismaMigrate);
  }

  // 6. Build (frontend only)
  if (!config.hasPrisma) {
    commands.push(DEPLOYMENT_COMMANDS.bunBuild);
  }

  // 7. Start/restart app (backend only)
  if (config.hasPrisma && config.appName) {
    commands.push(DEPLOYMENT_COMMANDS.pm2Restart(config.appName));
  }

  return commands;
}

export function buildDeploymentYaml(config: DeploymentConfig): string {
  const commands = buildSshCommands(config);
  const sshScript =
    SSH_COMMAND_BASE + commands.map((cmd) => cmd.trim()).join("\n");

  return `trigger:
  tags:
    include:
      - v*

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: SSH@0
    inputs:
      sshEndpoint: '${config.sshEndpoint}'
      runOptions: 'inline'
      inline: |
${sshScript
  .split("\n")
  .map((line) => (line.trim() ? `        ${line}` : ""))
  .join("\n")}
`;
}
