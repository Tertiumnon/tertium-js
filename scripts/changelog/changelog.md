# Changelog

Generates a `CHANGELOG.md` entry from git history - fully automatic, no manual writing required.

## What It Does

Wired as npm's own [`version` lifecycle script](https://docs.npmjs.com/cli/v10/commands/npm-version#description), so it runs automatically every time `npm version <type>` bumps the version - whether that's triggered directly or via the `release` script. At that point in the lifecycle, `package.json` already has the new version but the git tag/commit for it don't exist yet, so:

1. Reads the new version from `package.json`.
2. Finds the previous release's git tag (or, on the very first release, the whole history).
3. Lists non-merge commit subjects since that tag, dropping any stray bare version-number commit (e.g. a leftover `2.9.0`).
4. Prepends `## <version> - <date>` and the commit list to `CHANGELOG.md`, creating the file on first use.
5. Stages the file so it's swept into the same commit `npm version` creates for the bump - no separate commit, nothing left uncommitted.

Deliberately minimal: a flat bullet list of commit subjects, not categorized or reworded. If your commits already follow a `type: subject` convention (`feat:`, `fix:`, `chore:`, ...), the changelog reads that way for free.

## Usage

Already wired into this package's own `npm version` (see `package.json`'s `"version"` script). To use it in another project:

```json
{
  "scripts": {
    "version": "bun node_modules/@tertium/js/scripts/changelog/changelog.ts && git add CHANGELOG.md"
  }
}
```

No further setup - the next `npm version patch/minor/major` (including via this package's `release` script) will generate and commit the entry automatically.

### Preview without writing anything

```bash
bun run changelog                                              # this package
bun node_modules/@tertium/js/scripts/changelog/changelog.ts --dry-run   # another project
```

Prints the entry that would be generated for the current `package.json` version, without touching `CHANGELOG.md`.
