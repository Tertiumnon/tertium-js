export const SSH_COMMAND_BASE = `
set -e
export PATH="$HOME/.bun/bin:$PATH"
`;

export const DEPLOYMENT_COMMANDS = {
  gitSync: "git fetch origin main 2>&1 && git reset --hard origin/main 2>&1",
  envSource: "set -a && [ -f .env ] && source .env 2>&1 && set +a",
  bunInstall: (production: boolean) =>
    `bun install${production ? " --production" : ""} 2>&1`,
  prismaGenerate: "bunx prisma generate --schema=prisma/schema.prisma 2>&1",
  prismaMigrate:
    "bunx prisma migrate deploy --schema=prisma/schema.prisma 2>&1",
  bunBuild: "bun run build 2>&1",
  pm2Restart: (appName: string) =>
    `pm2 restart ${appName} || pm2 start pm2.config.cjs 2>&1 && pm2 save`,
};
