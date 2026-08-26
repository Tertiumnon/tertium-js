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
  /**
   * Comma-separated project-relative directories to ship as-is (e.g.
   * "src,prisma"), instead of a single pre-built DIST_DIR. Activates
   * "source mode": no local build/bundle step, Bun runs the TypeScript
   * source directly on the remote host via `--interpreter bun`. Native
   * per-platform work (e.g. `prisma generate`) then happens on the remote
   * host itself, which already has the right OS/arch.
   */
  SOURCE_DIRS?: string;
  /**
   * Project-relative path to schema.prisma (e.g. "prisma/schema.prisma").
   * When set, the remote setup step runs `prisma generate` against it after
   * `bun install`, so the Prisma Client's native query engine matches the
   * remote host's own platform instead of being cross-shipped from the
   * machine that built the app.
   */
  PRISMA_SCHEMA?: string;
  /**
   * Set to "true" to also run `prisma migrate deploy` against PRISMA_SCHEMA
   * on the remote host, after generate and before the app restarts. Off by
   * default: only enable this for projects whose migrations directory is
   * actually the source of truth for `_prisma_migrations` — some projects
   * apply schema changes through other means and keep prisma/migrations/
   * only for documentation, in which case `migrate deploy` should not run.
   */
  RUN_MIGRATIONS?: string;
}

export interface DeployConfig {
  projectDir?: string;
  env?: DeployEnv;
  skipBuild?: boolean;
  envFile?: string;
}
