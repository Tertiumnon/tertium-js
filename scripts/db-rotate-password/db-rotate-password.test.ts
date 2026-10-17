import { describe, expect, test } from "bun:test";
import {
  envValue,
  parseOptions,
  replaceDatabaseUrl,
  rotateAppPassword,
  sshDestinationFromEnv,
} from "./db-rotate-password";
import type {
  RotatePasswordOptions,
  RotatePasswordSystem,
} from "./db-rotate-password.types";

const OLD = "oldpassword";
const NEW = "NEWPASSWORD123";
const URL_OLD = `mysql://app:${OLD}@127.0.0.1:3306/Dungeons`;
const URL_NEW = URL_OLD.replace(OLD, NEW);
const PARAM_TEXT = `DEPLOY_USER=deploy\nDEPLOY_HOST=tertium\nDATABASE_URL="${URL_OLD}"\n`;
const ENV_TEXT = `PORT=12120\nDATABASE_URL="${URL_OLD}"\nJWT=keep\n`;
const options: RotatePasswordOptions = {
  ssmParam: "/env/app/env.prod",
  appPath: "/var/www/app",
  appName: "app",
  dryRun: false,
};

// A fake world: the SSM parameter (an env text), the database password, the app's .env and its PM2 status.
// Every call is recorded with its arguments, and secrets are only ever given to stdin.
function world(overrides: { status?: string; restartFails?: boolean } = {}) {
  const calls: {
    kind: string;
    args: string[];
    command?: string;
    input?: string;
  }[] = [];
  const logs: string[] = [];
  const state = {
    param: PARAM_TEXT,
    dbPassword: OLD,
    env: ENV_TEXT,
    status: overrides.status ?? "online",
    restarts: 0,
  };
  const system: RotatePasswordSystem = {
    hlpr: (args, input) => {
      calls.push({ kind: "hlpr", args, input });
      if (args[0] === "aws-param-store" && args[1] === "read")
        return state.param;
      if (args[0] === "mariadb" && args[1] === "rotate-password") {
        if (args.includes("-dry-run"))
          return "Dry run: would change the password";
        state.dbPassword = NEW;
        state.param = state.param.replace(URL_OLD, URL_NEW);
        return "Rotated Dungeons";
      }
      if (args[0] === "mariadb" && args[1] === "set-user-password") {
        state.dbPassword = input ?? "";
        return "Password set";
      }
      if (args[0] === "aws-param-store" && args[1] === "set") {
        state.param = state.param.replace(
          /DATABASE_URL="[^"]*"/,
          `DATABASE_URL="${input ?? ""}"`,
        );
        return "Set";
      }
      if (args[0] === "pm2" && args[1] === "restart") {
        state.restarts++;
        if (overrides.restartFails) throw new Error("hlpr pm2 restart failed");
        return "";
      }
      throw new Error(`unexpected hlpr ${args.join(" ")}`);
    },
    ssh: (host, command, input) => {
      calls.push({ kind: "ssh", args: [host], command, input });
      if (command.startsWith("cat ")) return state.env;
      if (command.includes("cat > .env.tmp")) {
        state.env = input ?? "";
        return "";
      }
      throw new Error(`unexpected ssh ${command}`);
    },
    pm2Status: (ssmParam, name) => {
      calls.push({ kind: "pm2Status", args: [ssmParam, name] });
      return state.status;
    },
    log: (message) => logs.push(message),
  };
  return { system, calls, logs, state };
}

describe("db-rotate-password", () => {
  test("the host is the one the parameter names; the database, the parameter and the app follow", async () => {
    const { system, calls, state, logs } = world();
    await rotateAppPassword(options, system);
    const kinds = calls.map(
      (call) =>
        `${call.kind}:${call.args[0]}${call.args[1] ? ` ${call.args[1]}` : ""}`,
    );
    expect(kinds).toEqual([
      "hlpr:aws-param-store read",
      "ssh:deploy@tertium",
      "hlpr:mariadb rotate-password",
      "hlpr:aws-param-store read",
      "ssh:deploy@tertium",
      "hlpr:pm2 restart",
      "pm2Status:/env/app/env.prod app",
    ]);
    expect(state.env).toContain(`DATABASE_URL="${URL_NEW}"`);
    expect(state.env).toContain("JWT=keep");
    expect(state.param).toContain(`DATABASE_URL="${URL_NEW}"`);
    expect(state.restarts).toBe(1);
    expect(logs.join("\n")).not.toContain(NEW);
  });

  test("the password only travels on stdin, never in arguments or commands", async () => {
    const { system, calls } = world({ restartFails: true });
    await expect(rotateAppPassword(options, system)).rejects.toThrow(
      "rolled back where possible",
    );
    for (const call of calls) {
      expect(call.args.join(" ")).not.toContain(NEW);
      expect(call.args.join(" ")).not.toContain(OLD);
      expect(call.command ?? "").not.toContain(NEW);
      expect(call.command ?? "").not.toContain(OLD);
    }
  });

  test("dry run reads and plans, and changes nothing", async () => {
    const { system, calls, state, logs } = world();
    await rotateAppPassword({ ...options, dryRun: true }, system);
    expect(
      calls.some(
        (call) =>
          call.args.includes("rotate-password") &&
          !call.args.includes("-dry-run"),
      ),
    ).toBe(false);
    expect(state.dbPassword).toBe(OLD);
    expect(state.env).toBe(ENV_TEXT);
    expect(logs.join("\n")).toContain(
      "Then update /var/www/app/.env on deploy@tertium and restart app",
    );
  });

  test("an app that is not online is rolled back: .env restored, restarted, database and parameter reverted", async () => {
    const { system, calls, state } = world({ status: "errored" });
    await expect(rotateAppPassword(options, system)).rejects.toThrow(
      "app is errored after the restart",
    );
    expect(state.env).toBe(ENV_TEXT);
    expect(state.dbPassword).toBe(OLD);
    expect(state.param).toBe(PARAM_TEXT);
    const order = calls.map(
      (call) => `${call.kind}:${call.args.slice(0, 2).join(" ")}`,
    );
    const rollback = order.slice(
      order.indexOf("hlpr:mariadb rotate-password") + 1,
    );
    expect(rollback.slice(-4)).toEqual([
      "ssh:deploy@tertium",
      "hlpr:pm2 restart",
      "hlpr:mariadb set-user-password",
      "hlpr:aws-param-store set",
    ]);
  });

  test("a failed rotation in hlpr stops before the app is touched", async () => {
    const { system, calls } = world();
    const failing = {
      ...system,
      hlpr: (args: string[], input?: string) => {
        if (args[1] === "rotate-password" && !args.includes("-dry-run"))
          throw new Error("hlpr rolled back");
        return system.hlpr(args, input);
      },
    };
    await expect(rotateAppPassword(options, failing)).rejects.toThrow(
      "hlpr rolled back",
    );
    expect(
      calls.some((call) => call.kind === "ssh" && call.command?.includes(">")),
    ).toBe(false);
  });

  test("an app .env without DATABASE_URL fails before anything changes", async () => {
    const { system, calls } = world();
    const noUrl = {
      ...system,
      ssh: (host: string, command: string, input?: string) => {
        if (command.startsWith("cat ")) return "PORT=1\n";
        return system.ssh(host, command, input);
      },
    };
    await expect(rotateAppPassword(options, noUrl)).rejects.toThrow(
      "DATABASE_URL is not set",
    );
    expect(calls.some((call) => call.args.includes("rotate-password"))).toBe(
      false,
    );
  });

  test("a parameter with no host fails before anything changes", async () => {
    const { system, calls } = world();
    const noHost = {
      ...system,
      hlpr: (args: string[], input?: string) =>
        args[1] === "read"
          ? "DATABASE_URL=mysql://a:b@h/db\n"
          : system.hlpr(args, input),
    };
    await expect(
      rotateAppPassword(
        { ...options, appPath: undefined, appName: undefined },
        noHost,
      ),
    ).rejects.toThrow("no DB_SSH_HOST or DEPLOY_HOST");
    expect(calls.some((call) => call.args.includes("rotate-password"))).toBe(
      false,
    );
  });
});

describe("db-rotate-password options and env values", () => {
  test("parses the flags; the host is not one of them", () => {
    expect(
      parseOptions([
        "--ssm-param=/env/app/env.prod",
        "--app-path=/var/www/app",
        "--app-name=app",
      ]),
    ).toEqual({
      ssmParam: "/env/app/env.prod",
      appPath: "/var/www/app",
      appName: "app",
      dryRun: false,
    });
    expect(
      parseOptions(["--ssm-param=/env/x/env.dev", "--dry-run"]).dryRun,
    ).toBe(true);
    expect(() =>
      parseOptions(["--ssm-param=/env/x", "--host=drh-mini"]),
    ).toThrow("Usage:");
  });

  test("needs the parameter, and the app flags together", () => {
    expect(() => parseOptions([])).toThrow("Usage:");
    expect(() =>
      parseOptions(["--ssm-param=/env/x", "--app-path=/var/www/x"]),
    ).toThrow("go together");
    expect(() =>
      parseOptions(["--ssm-param=/env/x", "--ssm-param=/env/y"]),
    ).toThrow("Usage:");
  });

  test("validates the parameter, the app path and the PM2 name", () => {
    expect(() => parseOptions(["--ssm-param=env/x"])).toThrow(
      "must be a parameter name",
    );
    expect(() =>
      parseOptions(["--ssm-param=/env/x", "--app-path=var/x", "--app-name=x"]),
    ).toThrow("absolute path");
    expect(() =>
      parseOptions([
        "--ssm-param=/env/x",
        "--app-path=/var/x;rm",
        "--app-name=x",
      ]),
    ).toThrow("absolute path");
    expect(() =>
      parseOptions([
        "--ssm-param=/env/x",
        "--app-path=/var/x",
        "--app-name=x y",
      ]),
    ).toThrow("PM2 process name");
  });

  test("the destination is user@host from DEPLOY_*, with DB_SSH_* winning", () => {
    expect(sshDestinationFromEnv(PARAM_TEXT)).toBe("deploy@tertium");
    expect(sshDestinationFromEnv(`${PARAM_TEXT}DB_SSH_HOST=db1\n`)).toBe(
      "deploy@db1",
    );
    expect(sshDestinationFromEnv("DEPLOY_HOST=drh-mini\n")).toBe("drh-mini");
  });

  test("reads and replaces values, keeping their quotes", () => {
    expect(envValue(PARAM_TEXT, "DEPLOY_HOST")).toBe("tertium");
    expect(envValue(PARAM_TEXT, "NOPE")).toBeUndefined();
    expect(replaceDatabaseUrl(ENV_TEXT, "mysql://a:b@h/db")).toBe(
      'PORT=12120\nDATABASE_URL="mysql://a:b@h/db"\nJWT=keep\n',
    );
    expect(() => replaceDatabaseUrl("PORT=1\n", "mysql://a:b@h/db")).toThrow(
      "DATABASE_URL is not set",
    );
  });
});
