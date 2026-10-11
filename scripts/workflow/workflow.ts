#!/usr/bin/env bun
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { fetchParamValue, parseEnvContent } from "../aws-env/aws-env";
import type {
  EnvironmentLoader,
  Workflow,
  WorkflowContext,
  WorkflowInput,
} from "./workflow.types";

// Runs a project's own workflow - `.tertium/workflows/<name>.yml`, written in GitHub Actions'
// syntax - on this machine, step by step. See workflow.md for the subset that is executed.

const WORKFLOW_DIR = ".tertium/workflows";

// Keys the runner acts on, and keys GitHub reads that mean nothing locally. Anything else stops the
// run: a key that would silently do nothing here (`if`, `strategy`) is worse than an error.
const WORKFLOW_KEYS = ["name", "on", "env", "defaults", "jobs"];
const WORKFLOW_IGNORED = ["run-name", "permissions", "concurrency"];
const JOB_KEYS = ["name", "environment", "needs", "env", "steps"];
const JOB_IGNORED = ["runs-on", "permissions", "timeout-minutes"];
const STEP_KEYS = ["name", "run", "uses", "env", "shell", "working-directory"];
const STEP_IGNORED = ["id", "with", "timeout-minutes"];

const assertKeys = (
  what: string,
  value: object,
  known: string[],
  ignored: string[],
): void => {
  const unknown = Object.keys(value).filter(
    (key) => !known.includes(key) && !ignored.includes(key),
  );
  if (unknown.length > 0)
    throw new Error(
      `${what}: "${unknown.join('", "')}" is not supported by the local runner (supported: ${known.join(", ")})`,
    );
};

export const parseWorkflow = (text: string): Workflow => {
  const workflow = Bun.YAML.parse(text) as Workflow;
  if (!workflow || typeof workflow !== "object" || !workflow.jobs)
    throw new Error("A workflow needs `jobs`");
  assertKeys("workflow", workflow, WORKFLOW_KEYS, WORKFLOW_IGNORED);
  const shell = workflow.defaults?.run?.shell;
  if (shell && shell !== "bash")
    throw new Error(`defaults.run.shell: only bash is run, not "${shell}"`);
  for (const [jobId, job] of Object.entries(workflow.jobs)) {
    assertKeys(`job "${jobId}"`, job, JOB_KEYS, JOB_IGNORED);
    if (!Array.isArray(job.steps))
      throw new Error(`job "${jobId}" needs \`steps\``);
    job.steps.forEach((step, index) => {
      const label = `job "${jobId}", step ${index + 1}`;
      assertKeys(label, step, STEP_KEYS, STEP_IGNORED);
      if (!step.run && !step.uses)
        throw new Error(`${label} needs \`run\` or \`uses\``);
      if (step.shell && step.shell !== "bash")
        throw new Error(`${label}: only bash is run, not "${step.shell}"`);
    });
  }
  return workflow;
};

/** `${{ inputs.target }}`, `${{ secrets.DEPLOY_HOST }}`, `${{ vars.PORT }}`, `${{ env.APP }}`. */
export const expand = (text: string, context: WorkflowContext): string =>
  text.replace(/\$\{\{\s*(.*?)\s*\}\}/g, (_, expression: string) => {
    const match = expression.match(/^(inputs|env|secrets|vars)\.([\w-]+)$/);
    if (!match)
      throw new Error(
        `\${{ ${expression} }} is not supported: only inputs.*, env.*, secrets.* and vars.* are read`,
      );
    const value =
      context[match[1] as keyof WorkflowContext][match[2] as string];
    if (value === undefined)
      throw new Error(`\${{ ${expression} }} is not set`);
    return value;
  });

const expandEnv = (
  env: Record<string, string> | undefined,
  context: WorkflowContext,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(env ?? {}).map(([key, value]) => [
      key,
      expand(String(value), context),
    ]),
  );

/** The `workflow_dispatch` inputs with what was given on the command line (`-f name=value`). */
export const resolveInputs = (
  declared: Record<string, WorkflowInput>,
  given: Record<string, string>,
): Record<string, string> => {
  const unknown = Object.keys(given).filter((name) => !(name in declared));
  if (unknown.length > 0)
    throw new Error(
      `Unknown input "${unknown.join('", "')}" (the workflow takes: ${Object.keys(declared).join(", ") || "none"})`,
    );
  const inputs: Record<string, string> = {};
  for (const [name, input] of Object.entries(declared)) {
    const value = given[name] ?? input.default;
    if (value === undefined) {
      if (input.required)
        throw new Error(
          `Input "${name}" is required: -f ${name}=${input.options?.join("|") ?? "<value>"}`,
        );
      continue;
    }
    if (input.options && !input.options.includes(String(value)))
      throw new Error(
        `Input "${name}" must be one of ${input.options.join(", ")}, not "${value}"`,
      );
    inputs[name] = String(value);
  }
  return inputs;
};

// On Windows a bare `bash` may be WSL's launcher. A workflow's scripts are for Git Bash, which
// ships with Git and brings ssh, scp and tar with it.
const bashPath = (): string =>
  process.platform === "win32"
    ? path.resolve(
        execFileSync("git", ["--exec-path"], { encoding: "utf-8" }).trim(),
        "../../../bin/bash.exe",
      )
    : "bash";

export type ScriptRunner = (
  script: string,
  options: { cwd: string; env: Record<string, string> },
) => void;

/** Runs a step's script as GitHub does: a file handed to `bash -eo pipefail`. */
const runScript: ScriptRunner = (script, { cwd, env }) => {
  const dir = mkdtempSync(path.join(tmpdir(), "tertium-workflow-"));
  try {
    const file = path.join(dir, "step.sh");
    writeFileSync(file, script);
    const result = spawnSync(
      bashPath(),
      ["--noprofile", "--norc", "-eo", "pipefail", file],
      {
        stdio: "inherit",
        cwd,
        // Git Bash rewrites an argument that starts with "/" into a Windows path, which breaks
        // remote paths handed to ssh and scp. A no-op everywhere else.
        env: { ...process.env, ...env, MSYS_NO_PATHCONV: "1" },
      },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`exit code ${result.status ?? result.signal}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** Every job in the order written, every step in turn; the first failing step stops the run. */
export const runWorkflow = (
  workflow: Workflow,
  options: {
    inputs: Record<string, string>;
    projectDir: string;
    loadEnvironment: EnvironmentLoader;
    run?: ScriptRunner;
  },
): void => {
  const run = options.run ?? runScript;
  const inputs = resolveInputs(
    workflow.on?.workflow_dispatch?.inputs ?? {},
    options.inputs,
  );
  const outside: WorkflowContext = { inputs, env: {}, secrets: {}, vars: {} };
  const workflowEnv = expandEnv(workflow.env, outside);

  for (const [jobId, job] of Object.entries(workflow.jobs)) {
    const environment = job.environment
      ? expand(job.environment, outside)
      : null;
    const loaded = environment ? options.loadEnvironment(environment) : {};
    const context = { inputs, secrets: loaded, vars: loaded };
    const jobEnv = {
      ...workflowEnv,
      ...expandEnv(job.env, { ...context, env: workflowEnv }),
    };
    console.log(
      `\n▶ ${workflow.name ?? "workflow"} / ${job.name ?? jobId}${environment ? ` (environment: ${environment})` : ""}`,
    );

    job.steps.forEach((step, index) => {
      const name = step.name ?? step.uses ?? `step ${index + 1}`;
      if (step.uses) {
        console.log(
          `\n○ ${name} - skipped: \`uses: ${step.uses}\` runs only on GitHub`,
        );
        return;
      }
      const env = {
        ...jobEnv,
        ...expandEnv(step.env, { ...context, env: jobEnv }),
      };
      console.log(`\n● ${name}`);
      // The script as written, before `${{ secrets.* }}` is filled in, so no secret is printed.
      for (const line of (step.run as string).trimEnd().split("\n"))
        console.log(`  $ ${line}`);
      try {
        run(expand(step.run as string, { ...context, env }), {
          cwd: path.resolve(
            options.projectDir,
            step["working-directory"] ??
              workflow.defaults?.run?.["working-directory"] ??
              ".",
          ),
          env,
        });
      } catch (error) {
        throw new Error(
          `Step "${name}" failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }
};

// An environment's variables live in AWS SSM as the target's env file - `/env/<repo>/env.<name>`,
// what `aws-env push --env-file=.env.<name>` uploads. Fetched into memory only.
const loadEnvironmentFromAws =
  (projectDir: string): EnvironmentLoader =>
  (environment) =>
    parseEnvContent(
      fetchParamValue(
        { projectDir, envFile: `.env.${environment}` },
        projectDir,
      ),
    );

// CLI: workflow.ts run <name> [-f input=value]...
if (process.argv[1]?.includes("workflow.ts")) {
  const [command, name, ...flags] = process.argv.slice(2);
  try {
    if (command !== "run" || !name)
      throw new Error("Usage: workflow.ts run <name> [-f input=value]...");
    const projectDir = process.cwd();
    const file = ["yml", "yaml"]
      .map((ext) => path.join(projectDir, WORKFLOW_DIR, `${name}.${ext}`))
      .find((candidate) => existsSync(candidate));
    if (!file)
      throw new Error(`No ${WORKFLOW_DIR}/${name}.yml in ${projectDir}`);

    const inputs: Record<string, string> = {};
    for (let i = 0; i < flags.length; i += 2) {
      const [key, ...value] = (flags[i + 1] ?? "").split("=");
      if (flags[i] !== "-f" || !key || value.length === 0)
        throw new Error(
          `Expected -f input=value, got "${flags.slice(i, i + 2).join(" ")}"`,
        );
      inputs[key] = value.join("=");
    }

    runWorkflow(parseWorkflow(readFileSync(file, "utf-8")), {
      inputs,
      projectDir,
      loadEnvironment: loadEnvironmentFromAws(projectDir),
    });
    console.log(`\n✓ ${name} finished`);
  } catch (error) {
    console.error(
      `\n✗ ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
