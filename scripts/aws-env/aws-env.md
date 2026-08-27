# AWS Env Command

Stores `.env*` files in AWS SSM Parameter Store (SecureString, standard tier — free, no rotation
machinery) so AWS, not a hand-maintained local file, is the source of truth. Five subcommands:
`push` a local file up (the source changed, save it), `pull` a parameter straight down (force the
exact current source), `sync` refresh the local cache with an offline fallback, `run` a command
with the local cache's variables injected into its environment, and `deploy` which fetches a
deploy-target env file fresh from AWS, uses it for exactly one deploy, and deletes it immediately
after - it's never written to a persistent local file at all.

## Local dev vs. deploy targets - two different local-storage stories

- **`.env`** (local dev): meant to persist locally as an offline-capable cache - see the `push` /
  `sync` + `run` workflow below. This is what you actually run the app against on your own machine.
- **`.env.dev` / `.env.prod`** (deploy targets - `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_PATH` plus
  whatever runtime secrets get bootstrapped onto that remote host): these should generally **not**
  sit on your laptop at all. Use `deploy` (see below) instead of `push`+`pull`+manually invoking
  `deploy.ts` - it fetches the config from AWS for the duration of a single deploy and removes it
  immediately after, success or failure. If you still have local `.env.dev`/`.env.prod` files left
  over from before this existed, `push` them once to make sure AWS has the current values, then
  delete the local copies - `deploy` doesn't need them on disk anymore.

## The `push` / `sync` + `run` workflow

The local env file is a **cache**, not something you hand-edit:

1. Edit secrets by hand only when actually changing them, then `push` to save that as the new
   source of truth in AWS.
2. Routinely (e.g. once per session, or in a pre-dev script) run `sync` to refresh the local file
   from AWS. If AWS is unreachable, `sync` degrades gracefully: it keeps whatever's already on disk
   and warns, rather than blocking you from working.
3. `run` never touches the network at all — it just reads whatever `sync` (or `pull`/`push`) last
   wrote locally and injects it into the command it runs. So a flaky connection can never stop
   `bun run dev` from starting; worst case you're running on a slightly stale cache until the next
   successful `sync`.

`pull` is the one exception to "never blocks": it always hits AWS and fails if it can't, because
its whole purpose is "give me the exact current source right now" (e.g. for debugging what's
actually stored) — for the routine day-to-day refresh, use `sync` instead.

## Why Parameter Store, not Secrets Manager

Secrets Manager costs ~$0.40/secret/month plus API charges and exists mainly for automatic
rotation. SSM Parameter Store's standard tier (up to 10,000 parameters, 4KB each) is free and just
as fast for plain get/put — the right fit for static dev/deploy env files that don't rotate.

## Requirements

- AWS CLI v2 installed and configured (`aws configure` or a shared credentials file) with
  `ssm:PutParameter` / `ssm:GetParameter` / `ssm:DeleteParameter` permission on the target path.
- On Windows + Git Bash: nothing extra to do — the tool sets `MSYS_NO_PATHCONV=1` on every `aws`
  invocation itself, since Git Bash's MSYS layer otherwise rewrites a leading-slash parameter name
  (e.g. `/env/my-app/env`) into a mangled Windows path before the AWS CLI ever sees it.

## Parameter naming

Auto-derived as `${paramPrefix}/${repoName}/${envFile with leading dots stripped}`:

```
.env         in project "my-app" → /env/my-app/env
.env.dev     in project "my-app" → /env/my-app/env.dev
.env.prod    in project "my-app" → /env/my-app/env.prod
```

- `repoName` is read from the project's `package.json` `"name"` (scope stripped, e.g.
  `@foo/bar` → `bar`), falling back to the project directory's basename.
- Override the base grouping path with `--prefix=/something`, the repo segment with
  `--repo=name`, or bypass auto-derivation entirely with `--param=/fully/qualified/name`.

## Usage

### As CLI Command

```bash
# Upload .env (or a specific file) to its auto-derived parameter - do this after hand-editing
bun scripts/aws-env/aws-env.ts push
bun scripts/aws-env/aws-env.ts push --env-file=.env.dev

# Refresh the local cache from AWS; falls back to the existing local file if AWS is unreachable
bun scripts/aws-env/aws-env.ts sync --env-file=.env.dev

# Force-fetch the exact current source, failing loudly if AWS is unreachable (debugging)
bun scripts/aws-env/aws-env.ts pull --env-file=.env.dev

# Run a command with the local cache's variables injected - purely local, no network call
bun scripts/aws-env/aws-env.ts run --env-file=.env.dev -- bun run dev
bun scripts/aws-env/aws-env.ts run --env-file=.env.prod -- bun run start

# Deploy using a deploy-target config fetched fresh from AWS - never persisted locally.
# --env-file is required (no default) since deploying without naming a target is too
# easy to get wrong. --skip-build passes through to the underlying deploy().
bun scripts/aws-env/aws-env.ts deploy --env-file=.env.dev
bun scripts/aws-env/aws-env.ts deploy --env-file=.env.prod --skip-build
```

Add npm/bun scripts to `package.json` for convenience:

```json
{
  "scripts": {
    "env:push": "bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts push",
    "env:push:dev": "bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts push --env-file=.env.dev",
    "env:sync": "bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts sync",
    "dev": "bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts sync && bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts run -- bun run dev:local",
    "dev:local": "vite",
    "deploy:dev": "bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts deploy --env-file=.env.dev --skip-build",
    "deploy:prod": "bun node_modules/@tertium/js/scripts/aws-env/aws-env.ts deploy --env-file=.env.prod --skip-build"
  }
}
```

(These `deploy:*` scripts replace calling `deploy/deploy.ts` directly - `aws-env deploy` wraps it,
so you get the exact same deploy behavior plus the fetch-from-AWS-and-discard-after step around it.)

(`dev:local` here is whatever your real framework dev command is — `run` wraps it rather than
replacing it, since it needs a command to inject the fetched variables into. Chaining `env:sync &&`
before `run` in the `dev` script gets you "always try to freshen the cache, but a network hiccup
never blocks starting the app" - if you'd rather sync less often than every dev start, drop that
and run `env:sync` manually instead.)

### As Library

```typescript
import { pushEnv, pullEnv, syncEnv, runWithEnv, deployWithEnv, resolveParamName } from '@tertium/js/scripts/aws-env';

pushEnv({ envFile: '.env.dev' });
pullEnv({ envFile: '.env.dev' });
syncEnv({ envFile: '.env.dev' });
runWithEnv({ envFile: '.env.dev' }, ['bun', 'run', 'dev']);
deployWithEnv({ envFile: '.env.prod' }, { skipBuild: true });

// Just resolve the parameter name a given config would use, without doing anything
resolveParamName({ projectDir: '/path/to/project', envFile: '.env.prod' });
// → "/env/<repo-name>/env.prod"
```

## Configuration (`AwsEnvConfig`)

```typescript
{
  projectDir?: string;   // default: process.cwd()
  envFile?: string;      // default: ".env"
  paramPrefix?: string;  // default: "/env"
  repoName?: string;     // default: auto-detected from package.json / dirname
  paramName?: string;    // full override, bypasses prefix/repoName/envFile derivation
  region?: string;       // passed through as `aws ... --region`
  profile?: string;      // passed through as `aws ... --profile`
}
```

## How It Works

- **`push`**: reads the local env file and uploads it via `aws ssm put-parameter --type
  SecureString --tier Standard --overwrite --value file://<path>`, so the file's exact bytes
  (comments, blank lines, formatting) go up untouched. Warns first if the file looks like it was
  last written by `sync` (has the auto-synced header) rather than hand-edited, since pushing it
  back would also upload that header line as real content.
- **`pull`**: fetches via `aws ssm get-parameter --with-decryption --output text` and writes it to
  the local file exactly, no header added. Fails outright if AWS is unreachable - use this only
  when you specifically need the current real source.
- **`sync`**: fetches the same way, but writes the local file with a `# auto-synced from AWS SSM
  ...` header marking it as a generated cache, and - critically - if the fetch fails and a local
  file already exists, logs a warning and leaves that file untouched instead of erroring out. Only
  errors if there's no local file to fall back to at all.
- **`run`**: reads the local env file directly (whatever `push`/`pull`/`sync` last wrote), parses
  it as `KEY=VALUE` lines (same tolerant parser as `deploy.ts`'s `loadEnv` - skips blank lines and
  `#` comments, splits on the first `=`), merges the result into `process.env`, and executes the
  given command with that merged environment. Makes no network calls itself.
- **`deploy`**: fetches into a distinctly-named temp file (`<envFile>.deploy-tmp`, never the real
  `.env.dev`/`.env.prod` - can't collide with or clobber a local copy you happen to still have),
  calls the real `deploy()` from `scripts/deploy/deploy.ts` pointed at that temp file, then removes
  it. Cleanup is registered on Node's `exit` event rather than a plain `try/finally`, because
  `deploy()` calls `process.exit(1)` directly on validation/deploy failure instead of throwing -
  `finally` would never run in that case, but an `exit` handler fires regardless of *how* the
  process is ending. Also deletes any stale temp file left over from a previous run that got killed
  mid-deploy, before starting.

## Security notes

- Values are stored as `SecureString`, encrypted with the account's default `alias/aws/ssm` KMS
  key — no extra KMS cost, no key management needed for personal/small-team use.
- `push`/`pull`/`sync` all use `--output text`/`--value file://...` rather than embedding the
  secret value as a literal CLI argument, so it never appears in shell history or process listings.
- IAM permissions on the parameter path are what actually control who can read a given secret —
  scope `ssm:GetParameter`/`ssm:PutParameter` to the relevant `/env/<repo-name>/*` path per
  principal rather than granting broad `ssm:*`.
- The local cache file still holds plaintext secrets on disk (same as any `.env` file always has)
  - make sure it's gitignored. This tool doesn't change that; it only changes where the *source of
  truth* lives.

## Troubleshooting

**`ValidationException: Parameter name must be a fully qualified name`**
- On Windows, this means `MSYS_NO_PATHCONV` didn't take effect — check you're invoking through
  `bun`/`node` directly rather than through another shell layer that strips the env var.

**`Unknown output type: JSON` (or similar) from the AWS CLI**
- Your `~/.aws/config` likely has an invalid `output` value (AWS CLI's output type is
  case-sensitive — `json`, not `JSON`). The tool always passes `--output` explicitly on its own
  calls so this shouldn't block `push`/`pull`/`sync`/`run`, but it's worth fixing in the config
  directly for every other `aws` command you run.

**`ParameterNotFound` on `pull`**
- Nothing has been `push`ed for that exact parameter name yet — check `resolveParamName()` (or add
  `--param=` explicitly) to confirm the name matches what was uploaded. On `sync`, this same error
  is caught and treated as "AWS unreachable" - falls back to the local cache instead of failing.

**`run` says the env file doesn't exist**
- `run` never fetches anything itself - run `sync` or `pull` (or `push`, if you're just about to
  edit) at least once first to create the local cache.
