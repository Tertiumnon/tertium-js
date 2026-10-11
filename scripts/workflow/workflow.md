# Workflow runner

Runs a project's own workflow on your machine. The workflow lives in the project, in
`.tertium/workflows/<name>.yml`, and is written in GitHub Actions' syntax - every step of a deploy is
there to read, not inside this package.

```bash
bun ./node_modules/@tertium/js/scripts/workflow/workflow.ts run deploy -f target=prod
```

`-f name=value` passes a `workflow_dispatch` input, as `gh workflow run` does.

## What is executed

| GitHub Actions | Here |
|---|---|
| `on.workflow_dispatch.inputs` | The inputs `-f` may set: `required`, `default`, `type: choice` + `options` are checked |
| `env` (workflow, job, step) | Exported to the step's script; a step's wins over the job's, the job's over the workflow's |
| `jobs.<id>.environment` | Names the target. Its secrets and vars are the env file kept in AWS SSM: `environment: dev` reads `/env/<package name>/env.dev` (what `aws-env push --env-file=.env.dev` uploads), in memory only. Every key is both `secrets.KEY` and `vars.KEY` |
| `jobs.<id>.steps[].run` | Run with `bash --noprofile --norc -eo pipefail`, as GitHub does for `shell: bash`. On Windows that is Git Bash, found next to `git` |
| `steps[].working-directory`, `defaults.run.working-directory` | Relative to the project |
| `steps[].uses` | Skipped with a note: an action runs only on GitHub (the working tree is the checkout) |
| `${{ inputs.x }}`, `${{ env.x }}`, `${{ secrets.x }}`, `${{ vars.x }}` | Filled in; a value that is not set stops the run |
| `runs-on`, `permissions`, `concurrency`, `timeout-minutes`, `id`, `with` | Read by GitHub only, ignored here |

Jobs run in the order written, steps in turn, and the first failing step stops the run.

Anything else - `if`, `strategy`, `needs` graphs, `services`, other expressions - is an error, not
silently ignored: a key that does nothing locally would make the file lie about what a run does.

## Notes

- A step's script is printed as written, before `${{ secrets.* }}` is filled in. What a command
  itself prints is not masked - pass secrets through `env` and never `echo` them.
- Git Bash rewrites an argument that starts with `/` into a Windows path; the runner turns that off
  (`MSYS_NO_PATHCONV=1`) so remote paths reach `ssh` and `scp` unchanged.
- The same file can run on GitHub once the repository has an environment with the same secret and
  variable names and a step that sets up the SSH key.

## Example

See `dungeons-api/.tertium/workflows/deploy.yml`: check the target, archive, upload, replace the
files on the host, install, generate the Prisma client, migrate, restart under PM2, check `/health`.
