export interface AwsEnvConfig {
  projectDir?: string;
  /** Local env file to read/write, e.g. ".env", ".env.dev", ".env.prod". Default ".env". */
  envFile?: string;
  /**
   * Base grouping path for auto-derived parameter names, e.g. "/env". Default "/env".
   * Ignored if `paramName` is set.
   */
  paramPrefix?: string;
  /**
   * Repo name segment for auto-derived parameter names. Auto-detected from the project's
   * package.json "name" (scope stripped) or the project directory's basename if omitted.
   * Ignored if `paramName` is set.
   */
  repoName?: string;
  /**
   * Full explicit SSM parameter name (e.g. "/env/my-app/env.prod"), overriding the
   * prefix/repoName/envFile auto-derivation entirely.
   */
  paramName?: string;
  /** --region passed to the AWS CLI, if set. Otherwise uses the CLI's own configured default. */
  region?: string;
  /** --profile passed to the AWS CLI, if set. Otherwise uses the CLI's own configured default. */
  profile?: string;
}
