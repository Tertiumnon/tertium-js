/** The subset of GitHub Actions' workflow syntax the local runner executes. */

export interface WorkflowInput {
  description?: string;
  required?: boolean;
  default?: string;
  type?: "string" | "choice" | "boolean" | "number" | "environment";
  options?: string[];
}

export interface WorkflowStep {
  name?: string;
  id?: string;
  /** A shell script, run with bash. */
  run?: string;
  /** A GitHub action: skipped locally (the working tree is the checkout). */
  uses?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  shell?: string;
  "working-directory"?: string;
}

export interface WorkflowJob {
  name?: string;
  "runs-on"?: string;
  /** Names the target (dev, prod): its secrets and vars are loaded for the job. */
  environment?: string;
  needs?: string | string[];
  env?: Record<string, string>;
  steps: WorkflowStep[];
}

export interface Workflow {
  name?: string;
  on?: { workflow_dispatch?: { inputs?: Record<string, WorkflowInput> } };
  env?: Record<string, string>;
  defaults?: { run?: { shell?: string; "working-directory"?: string } };
  jobs: Record<string, WorkflowJob>;
}

/** What `${{ … }}` can read. */
export interface WorkflowContext {
  inputs: Record<string, string>;
  env: Record<string, string>;
  secrets: Record<string, string>;
  vars: Record<string, string>;
}

/** Loads an environment's variables by its name: every key is both a secret and a var. */
export type EnvironmentLoader = (environment: string) => Record<string, string>;
