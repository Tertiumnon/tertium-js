/* biome-ignore-all lint/suspicious/noTemplateCurlyInString: these strings are the workflow expression syntax under test */
import { describe, expect, test } from "bun:test";
import {
  expand,
  parseWorkflow,
  resolveInputs,
  runWorkflow,
  type ScriptRunner,
} from "./workflow";
import type { WorkflowInput } from "./workflow.types";

const WORKFLOW = `
name: Deploy
on:
  workflow_dispatch:
    inputs:
      target:
        required: true
        type: choice
        options: [dev, prod]
env:
  APP_NAME: api
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: \${{ inputs.target }}
    env:
      REMOTE: \${{ secrets.DEPLOY_USER }}@\${{ secrets.DEPLOY_HOST }}
    steps:
      - uses: actions/checkout@v4
      - name: Upload
        run: scp app.tar.gz "$REMOTE:\${{ vars.DEPLOY_PATH }}"
      - name: Restart
        working-directory: ops
        env:
          PORT: \${{ vars.PORT }}
        run: |
          echo \${{ env.APP_NAME }} on $PORT
`;

const run = (target: string) => {
  const calls: { script: string; cwd: string; env: Record<string, string> }[] =
    [];
  const record: ScriptRunner = (script, { cwd, env }) => {
    calls.push({ script, cwd, env });
  };
  runWorkflow(parseWorkflow(WORKFLOW), {
    inputs: { target },
    projectDir: "/project",
    loadEnvironment: (environment) => ({
      DEPLOY_USER: "deploy",
      DEPLOY_HOST: `${environment}-host`,
      DEPLOY_PATH: "/var/www/api",
      PORT: "8091",
    }),
    run: record,
  });
  return calls;
};

describe("runWorkflow", () => {
  test("runs the `run` steps in order with the environment's secrets and vars, skipping `uses`", () => {
    const calls = run("prod");
    expect(calls.map((c) => c.script.trim())).toEqual([
      'scp app.tar.gz "$REMOTE:/var/www/api"',
      "echo api on $PORT",
    ]);
    expect(calls[0]?.env).toEqual({
      APP_NAME: "api",
      REMOTE: "deploy@prod-host",
    });
    expect(calls[1]?.env).toEqual({
      APP_NAME: "api",
      REMOTE: "deploy@prod-host",
      PORT: "8091",
    });
  });

  test("runs a step in its working directory, the project's by default", () => {
    const calls = run("dev");
    expect(
      calls.map((c) => c.cwd.replace(/\\/g, "/").replace(/^\w:/, "")),
    ).toEqual(["/project", "/project/ops"]);
  });

  test("stops at the first failing step and names it", () => {
    const ran: string[] = [];
    expect(() =>
      runWorkflow(parseWorkflow(WORKFLOW), {
        inputs: { target: "dev" },
        projectDir: "/project",
        loadEnvironment: () => ({
          DEPLOY_USER: "u",
          DEPLOY_HOST: "h",
          DEPLOY_PATH: "/p",
          PORT: "1",
        }),
        run: (script) => {
          ran.push(script);
          throw new Error("exit code 1");
        },
      }),
    ).toThrow('Step "Upload" failed: exit code 1');
    expect(ran).toHaveLength(1);
  });
});

describe("resolveInputs", () => {
  const declared = {
    target: { required: true, type: "choice", options: ["dev", "prod"] },
    tag: { default: "latest" },
  } satisfies Record<string, WorkflowInput>;

  test("takes what was given and the defaults", () => {
    expect(resolveInputs(declared, { target: "dev" })).toEqual({
      target: "dev",
      tag: "latest",
    });
  });

  test("refuses a missing required input, a value outside the options, an unknown input", () => {
    expect(() => resolveInputs(declared, {})).toThrow(
      'Input "target" is required',
    );
    expect(() => resolveInputs(declared, { target: "stage" })).toThrow(
      "must be one of dev, prod",
    );
    expect(() =>
      resolveInputs(declared, { target: "dev", force: "1" }),
    ).toThrow('Unknown input "force"');
  });
});

describe("expand", () => {
  const context = {
    inputs: { target: "dev" },
    env: {},
    secrets: { KEY: "s3cret" },
    vars: {},
  };

  test("fills in the contexts it knows", () => {
    expect(expand("${{ inputs.target }}:${{secrets.KEY}}", context)).toBe(
      "dev:s3cret",
    );
  });

  test("refuses a value that is not set and an expression it cannot read", () => {
    expect(() => expand("${{ secrets.MISSING }}", context)).toThrow(
      "${{ secrets.MISSING }} is not set",
    );
    expect(() => expand("${{ github.sha }}", context)).toThrow(
      "is not supported",
    );
  });
});

describe("parseWorkflow", () => {
  test("refuses what the local runner would silently ignore", () => {
    expect(() =>
      parseWorkflow(
        "jobs:\n  a:\n    steps:\n      - run: x\n        if: always()\n",
      ),
    ).toThrow('"if" is not supported');
    expect(() =>
      parseWorkflow(
        "jobs:\n  a:\n    strategy: {}\n    steps:\n      - run: x\n",
      ),
    ).toThrow('"strategy" is not supported');
    expect(() =>
      parseWorkflow(
        "jobs:\n  a:\n    steps:\n      - run: x\n        shell: pwsh\n",
      ),
    ).toThrow("only bash is run");
  });
});
