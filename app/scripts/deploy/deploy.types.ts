export interface DeployConfig {
  remoteHost: string;
  deployPath: string;
  appName: string;
  localDist: string;
  tempPath: string;
  sshHost?: string;
  envFile?: string;
  buildCommand?: string;
  port?: number;
  serverFile?: string;
  skipDotfiles?: boolean;
}

export interface DeployOptions {
  skipBuild?: boolean;
  verbose?: boolean;
}

export interface DeployResult {
  success: boolean;
  message: string;
  timestamp: string;
}
