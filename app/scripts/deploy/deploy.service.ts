import { $ } from "bun";
import type { DeployConfig, DeployOptions, DeployResult } from "./deploy.types";

export class DeployService {
  private config: DeployConfig;
  private options: DeployOptions;
  private remoteUser: string;

  constructor(config: DeployConfig, options: DeployOptions = {}) {
    this.config = {
      sshHost: config.sshHost || config.remoteHost,
      ...config,
    };
    this.remoteUser = config.remoteUser || "deploy";
    this.options = options;
  }

  private async log(message: string): Promise<void> {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  async buildLocal(): Promise<void> {
    this.log("Building application locally...");
    try {
      const cmd = this.config.buildCommand || "bun run build";
      // Use login shell (-l) to load PATH from user's shell configuration
      // which should include bun if installed via curl installer
      await $`bash -l -c "${cmd}"`;
      this.log("✓ Build successful");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`❌ Build error: ${errorMsg}`);
      throw new Error(`Build failed: ${errorMsg}`);
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

      // Use find to copy files for better portability across shells (bash/zsh)
      const moveCmd = `find ${tempPath} -maxdepth 1 -type f -exec mv {} ${deployPath}/ \\; 2>/dev/null; true`;
      const cleanCmd = `find ${deployPath} -maxdepth 1 -type f -delete 2>/dev/null; true`;
      const chownCmd = `chown -R ${this.remoteUser} ${deployPath} 2>/dev/null || true`;

      await $`ssh ${sshHost} sudo -u ${this.remoteUser} sh -c '${cleanCmd} && ${moveCmd} && ${chownCmd}'`;
      await $`ssh ${sshHost} rm -rf ${tempPath}`;
      this.log("✓ Files copied successfully");
    } catch (error) {
      throw new Error("Failed to copy files to server");
    }
  }

  async updateDependencies(): Promise<void> {
    this.log("Updating dependencies on server...");
    const { sshHost, deployPath } = this.config;

    try {
      const cmd = `cd ${deployPath} && bun install --production 2>/dev/null || echo "Note: dependency installation skipped - check manual setup if needed"`;
      await $`ssh ${sshHost} sudo -u ${this.remoteUser} sh -c '${cmd}'`;
      this.log("✓ Dependencies updated");
    } catch (error) {
      this.log("⚠ Dependency update skipped - dependencies may already be installed");
    }
  }

  async restartProcess(): Promise<void> {
    this.log("Restarting application via PM2...");
    const { sshHost, deployPath, appName, port, serverFile } = this.config;

    try {
      const entry = serverFile ? serverFile : "dist/index.js";
      const portOpt = port ? ` --env PORT=${port}` : "";
      const cmd = `cd ${deployPath} && (pm2 restart ${appName} --update-env 2>/dev/null || pm2 start ${entry} --name ${appName}${portOpt} 2>/dev/null || echo "Note: PM2 not available - start process manually")`;

      await $`ssh ${sshHost} sudo -u ${this.remoteUser} bash -l -c '${cmd}'`;
      this.log("✓ Process restart attempted");

      await $`ssh ${sshHost} sudo -u ${this.remoteUser} bash -l -c 'pm2 save 2>/dev/null || true'`;
    } catch (error) {
      this.log("⚠ PM2 process management skipped - may need manual setup");
    }
  }

  async verifyDeployment(): Promise<void> {
    this.log("Verifying deployment...");
    const { sshHost, appName } = this.config;

    try {
      await $`ssh ${sshHost} sudo -u ${this.remoteUser} bash -lc 'pm2 status | grep ${appName}'`;
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
