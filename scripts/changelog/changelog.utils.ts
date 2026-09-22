import { CHANGELOG_TITLE, SEMVER_ONLY_PATTERN } from "./changelog.constants";

// `rawLog` is the trimmed stdout of `git log ... --pretty=format:%s` - one
// subject per line. Drops blank lines and a stray bare version-number commit
// (e.g. "2.9.0", from a previous `npm version` run) that isn't a real change.
export function filterCommitSubjects(rawLog: string): string[] {
  if (!rawLog.trim()) return [];
  return rawLog
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !SEMVER_ONLY_PATTERN.test(line));
}

export function buildEntry(
  version: string,
  date: string,
  subjects: string[],
): string {
  const bullets =
    subjects.length > 0
      ? subjects.map((subject) => `- ${subject}`).join("\n")
      : "- (no changes recorded)";
  return `## ${version} - ${date}\n\n${bullets}\n`;
}

// Prepends `entry` right after the "# Changelog" title so entries read
// newest-first. `existing` is null on the first-ever run (file doesn't exist
// yet), in which case the title itself is created too.
export function mergeChangelogContent(
  existing: string | null,
  entry: string,
): string {
  const heading = `${CHANGELOG_TITLE}\n`;
  if (existing === null) return `${heading}\n${entry}\n`;

  const body = existing.startsWith(heading)
    ? existing.slice(heading.length).replace(/^\n+/, "")
    : existing;
  return `${heading}\n${entry}\n${body}`;
}

export function parsePackageVersion(rawPackageJson: string): string {
  const pkg = JSON.parse(rawPackageJson);
  if (!pkg.version) {
    throw new Error('No "version" field found in package.json');
  }
  return pkg.version;
}

export function todayIso(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
