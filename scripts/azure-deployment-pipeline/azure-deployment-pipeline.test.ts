import { expect, test } from "bun:test";
import type { DeploymentConfig } from "./azure-deployment-pipeline.types";
import {
  buildDeploymentYaml,
  buildSshCommands,
} from "./azure-deployment-pipeline.utils";

test("buildSshCommands - backend with Prisma", () => {
  const config: DeploymentConfig = {
    projectName: "test-api",
    environment: "production",
    deployPath: "/var/www/test-api",
    sshEndpoint: "test-api-prod-ssh",
    hasPrisma: true,
    appName: "test-api",
  };

  const commands = buildSshCommands(config);

  expect(commands).toContain("cd /var/www/test-api");
  expect(commands.some((cmd) => cmd.includes("git fetch"))).toBe(true);
  expect(commands.some((cmd) => cmd.includes("prisma generate"))).toBe(true);
  expect(commands.some((cmd) => cmd.includes("prisma migrate"))).toBe(true);
  expect(commands.some((cmd) => cmd.includes("pm2 restart"))).toBe(true);
  expect(commands.some((cmd) => cmd.includes("bun run build"))).toBe(false);
});

test("buildSshCommands - frontend without Prisma", () => {
  const config: DeploymentConfig = {
    projectName: "test-www",
    environment: "production",
    deployPath: "/var/www/test-www",
    sshEndpoint: "test-www-prod-ssh",
    hasPrisma: false,
  };

  const commands = buildSshCommands(config);

  expect(commands).toContain("cd /var/www/test-www");
  expect(commands.some((cmd) => cmd.includes("git fetch"))).toBe(true);
  expect(commands.some((cmd) => cmd.includes("prisma"))).toBe(false);
  expect(commands.some((cmd) => cmd.includes("bun run build"))).toBe(true);
  expect(commands.some((cmd) => cmd.includes("pm2 restart"))).toBe(false);
});

test("buildSshCommands - bun install with --production for backend", () => {
  const config: DeploymentConfig = {
    projectName: "test-api",
    environment: "production",
    deployPath: "/var/www/test-api",
    sshEndpoint: "test-api-prod-ssh",
    hasPrisma: true,
    appName: "test-api",
  };

  const commands = buildSshCommands(config);
  const installCmd = commands.find((cmd) => cmd.includes("bun install"));

  expect(installCmd).toContain("--production");
});

test("buildSshCommands - bun install without --production for frontend", () => {
  const config: DeploymentConfig = {
    projectName: "test-www",
    environment: "production",
    deployPath: "/var/www/test-www",
    sshEndpoint: "test-www-prod-ssh",
    hasPrisma: false,
  };

  const commands = buildSshCommands(config);
  const installCmd = commands.find((cmd) => cmd.includes("bun install"));

  expect(installCmd).not.toContain("--production");
});

test("buildDeploymentYaml - generates valid YAML with trigger and pool", () => {
  const config: DeploymentConfig = {
    projectName: "test-api",
    environment: "production",
    deployPath: "/var/www/test-api",
    sshEndpoint: "test-api-prod-ssh",
    hasPrisma: true,
    appName: "test-api",
  };

  const yaml = buildDeploymentYaml(config);

  expect(yaml).toContain("trigger:");
  expect(yaml).toContain("tags:");
  expect(yaml).toContain("- v*");
  expect(yaml).toContain("pool:");
  expect(yaml).toContain("vmImage: 'ubuntu-latest'");
});

test("buildDeploymentYaml - includes SSH endpoint", () => {
  const config: DeploymentConfig = {
    projectName: "test-api",
    environment: "production",
    deployPath: "/var/www/test-api",
    sshEndpoint: "test-api-prod-ssh",
    hasPrisma: true,
    appName: "test-api",
  };

  const yaml = buildDeploymentYaml(config);

  expect(yaml).toContain("sshEndpoint: 'test-api-prod-ssh'");
});

test("buildDeploymentYaml - includes SSH@0 task with inline commands", () => {
  const config: DeploymentConfig = {
    projectName: "test-api",
    environment: "production",
    deployPath: "/var/www/test-api",
    sshEndpoint: "test-api-prod-ssh",
    hasPrisma: true,
    appName: "test-api",
  };

  const yaml = buildDeploymentYaml(config);

  expect(yaml).toContain("task: SSH@0");
  expect(yaml).toContain("inline: |");
  expect(yaml).toContain("cd /var/www/test-api");
  expect(yaml).toContain("git fetch origin main");
  expect(yaml).toContain("git reset --hard origin/main");
});

test("buildDeploymentYaml - includes PATH export for bun", () => {
  const config: DeploymentConfig = {
    projectName: "test-api",
    environment: "production",
    deployPath: "/var/www/test-api",
    sshEndpoint: "test-api-prod-ssh",
    hasPrisma: true,
    appName: "test-api",
  };

  const yaml = buildDeploymentYaml(config);

  expect(yaml).toContain('export PATH="$HOME/.bun/bin:$PATH"');
});

test("buildDeploymentYaml - redirects stderr to stdout in commands", () => {
  const config: DeploymentConfig = {
    projectName: "test-api",
    environment: "production",
    deployPath: "/var/www/test-api",
    sshEndpoint: "test-api-prod-ssh",
    hasPrisma: true,
    appName: "test-api",
  };

  const yaml = buildDeploymentYaml(config);

  expect(yaml).toContain("2>&1");
});

test("buildSshCommands - environment variable sourcing", () => {
  const config: DeploymentConfig = {
    projectName: "test-api",
    environment: "production",
    deployPath: "/var/www/test-api",
    sshEndpoint: "test-api-prod-ssh",
    hasPrisma: true,
    appName: "test-api",
  };

  const commands = buildSshCommands(config);
  const envSourceCmd = commands.find((cmd) => cmd.includes("set -a"));

  expect(envSourceCmd).toBeDefined();
  expect(envSourceCmd).toContain("[");
  expect(envSourceCmd).toContain("source .env");
  expect(envSourceCmd).toContain("set +a");
});

test("buildDeploymentYaml - derived SSH endpoint matches config", () => {
  const config: DeploymentConfig = {
    projectName: "my-service",
    environment: "staging",
    deployPath: "/opt/services/my-service",
    sshEndpoint: "my-service-staging-ssh",
    hasPrisma: false,
  };

  const yaml = buildDeploymentYaml(config);

  expect(yaml).toContain("sshEndpoint: 'my-service-staging-ssh'");
});

test("buildSshCommands - preserves deploy path in cd command", () => {
  const config: DeploymentConfig = {
    projectName: "frontend",
    environment: "production",
    deployPath: "/srv/frontend",
    sshEndpoint: "frontend-prod-ssh",
    hasPrisma: false,
  };

  const commands = buildSshCommands(config);

  expect(commands[0]).toEqual("cd /srv/frontend");
});
