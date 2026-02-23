import { $ } from "bun";
import type { DeployConfig, DeployOptions, DeployResult } from "./deploy.types";

export class DeployService {
  private config: DeployConfig;
  private options: DeployOptions;

  constructor(config: DeployConfig, options: DeployOptions = {}) {
    this.config = {
      sshHost: config.sshHost || config.remoteHost,
      ...config,
    };
    this.options = options;
  }

  private async log(message: string): Promise<void> {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  async buildLocal(): Promise<void> {
    this.log("Building application locally...");
    try {
      const cmd = this.config.buildCommand || "bun run build";
      await $`bash -c "${cmd}"`;
      this.log("✓ Build successful");
    } catch (error) {
      throw new Error("Build failed");
    }
  }

  async copyToServer(): Promise<void> {
    this.log("Copying built files to remote server...");
    const { sshHost, tempPath, deployPath, localDist, envFile, skipDotfiles } = this.config;

    try {
      await $`ssh ${sshHost} mkdir -p ${tempPath}`;
      await $`scp -r ${localDist} ${sshHost}:${tempPath}/`;

      // Copy package.json and lock files
      await $`bash -c "scp package.json ${sshHost}:${tempPath}/ 2>/dev/null || true"`;
      await $`bash -c "scp package-lock.json ${sshHost}:${tempPath}/ 2>/dev/null || true"`;
      await $`bash -c "scp bun.lock ${sshHost}:${tempPath}/ 2>/dev/null || true"`;

      // Copy server files if present
      if (this.config.serverFile) {
        await $`bash -c "scp ${this.config.serverFile} ${sshHost}:${tempPath}/ 2>/dev/null || true"`;
      }

      // Copy .env file
      if (envFile) {
        try {
          await $`scp ${envFile} ${sshHost}:${tempPath}/.env`;
          this.log("✓ .env file copied to temp");
        } catch {
          this.log("⚠ .env copy skipped (file may not exist)");
        }
      }

      await $`ssh ${sshHost} chmod -R 777 ${tempPath} && mkdir -p ${deployPath}`;

      const moveCmd = skipDotfiles
        ? `mv ${tempPath}/* ${deployPath}/`
        : `shopt -s dotglob && mv ${tempPath}/* ${deployPath}/`;

      await $`ssh ${sshHost} sudo -u deploy bash -lc 'rm -rf ${deployPath}/* && ${moveCmd}' && sudo chown -R deploy:deploy ${deployPath} && rm -rf ${tempPath}`;
      this.log("✓ Files copied successfully");
    } catch (error) {
      throw new Error("Failed to copy files to server");
    }
  }

  async updateDependencies(): Promise<void> {
    this.log("Updating dependencies on server...");
    const { sshHost, deployPath } = this.config;

    try {
      await $`ssh ${sshHost} sudo -u deploy bash -lc 'cd ${deployPath} && npm install --production'`;
      this.log("✓ Dependencies updated");
    } catch (error) {
      throw new Error("Failed to update dependencies");
    }
  }

  async restartProcess(): Promise<void> {
    this.log("Restarting application via PM2...");
    const { sshHost, deployPath, appName, port, serverFile } = this.config;

    try {
      const entry = serverFile ? serverFile : "dist/index.js";
      const portOpt = port ? ` --env PORT=${port}` : "";
      const cmd = `cd ${deployPath} && pm2 restart ${appName} --update-env || pm2 start ${entry} --name ${appName}${portOpt}`;

      await $`ssh ${sshHost} sudo -u deploy bash -lc '${cmd}'`;
      this.log("✓ Process restarted");

      await $`ssh ${sshHost} sudo -u deploy bash -lc 'pm2 save'`;
    } catch (error) {
      throw new Error("Failed to restart process");
    }
  }

  async verifyDeployment(): Promise<void> {
    this.log("Verifying deployment...");
    const { sshHost, appName } = this.config;

    try {
      await $`ssh ${sshHost} sudo -u deploy bash -lc 'pm2 status | grep ${appName}'`;
      this.log("✓ Deployment verified");
    } catch {
      console.warn("⚠ Could not verify deployment status");
    }
  }

  async deploy(): Promise<DeployResult> {
    const startTime = new Date().toISOString();

    try {
      this.log("Starting deployment process...");

      if (!this.options.skipBuild) {
        await this.buildLocal();
      } else {
        this.log("Skipping build (--skip-build flag set)");
      }

      await this.copyToServer();
      await this.updateDependencies();
      await this.restartProcess();
      await this.verifyDeployment();

      this.log("✅ Deployment completed successfully");

      return {
        success: true,
        message: "Deployment completed successfully",
        timestamp: startTime,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.log(`❌ Deployment failed: ${message}`);

      return {
        success: false,
        message,
        timestamp: startTime,
      };
    }
  }
}

export async function createDeployService(
  config: DeployConfig,
  options: DeployOptions = {}
): Promise<DeployService> {
  return new DeployService(config, options);
}
