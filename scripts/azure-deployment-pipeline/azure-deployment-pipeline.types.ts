export interface DeploymentConfig {
  projectName: string;
  environment: string;
  deployPath: string;
  sshEndpoint: string;
  hasPrisma: boolean;
  appName?: string;
}

export interface PromptAnswers {
  projectName: string;
  environment: string;
  deployPath: string;
  sshEndpoint: string;
  hasPrisma: boolean;
  appName?: string;
}
