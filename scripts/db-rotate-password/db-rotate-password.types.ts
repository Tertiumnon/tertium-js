/** Flags of db-rotate-password.ts. */
export interface RotatePasswordOptions {
  /** ssh destination of the host the database and the app run on: a Host alias or HostName from ~/.ssh/config. */
  host: string;
  /** SSM parameter whose value is the app's env file (it holds DATABASE_URL). */
  ssmParam: string;
  /** Remote directory of the app, holding its .env. Needs appName. */
  appPath?: string;
  /** PM2 process name of the app, restarted so it reads the new .env. Needs appPath. */
  appName?: string;
  dryRun: boolean;
}

/** Everything that touches the outside world, so the flow can be tested without a server. */
export interface RotatePasswordSystem {
  /** Runs `hlpr` with the arguments and returns stdout. Throws with its stderr when it fails. */
  hlpr(args: string[], input?: string): string;
  /** Runs one command on the host over ssh, with optional stdin. Throws with ssh's stderr when it fails. */
  ssh(host: string, command: string, input?: string): string;
  /** The PM2 status of the process on the host: online, stopped, errored, or missing. */
  pm2Status(host: string, name: string): string;
  log(message: string): void;
}
