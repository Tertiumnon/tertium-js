export interface DeployEnv {
  DEPLOY_USER: string;
  DEPLOY_HOST: string;
  DEPLOY_PATH: string;
  STATIC_SITE?: string;
  DIST_DIR?: string;
  APP_NAME?: string;
  BUILD_COMMAND?: string;
  SERVER_FILE?: string;
  PORT?: string;
}

export interface DeployConfig {
  projectDir?: string;
  env?: DeployEnv;
  skipBuild?: boolean;
  envFile?: string;
}
