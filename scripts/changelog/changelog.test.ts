import { expect, test } from "bun:test";
import {
  buildEntry,
  filterCommitSubjects,
  mergeChangelogContent,
  parsePackageVersion,
  todayIso,
} from "./changelog.utils";

test("filterCommitSubjects - keeps ordinary commit subjects in order", () => {
  const raw = "feat: add widget support\nfix: correct off-by-one";
  expect(filterCommitSubjects(raw)).toEqual([
    "feat: add widget support",
    "fix: correct off-by-one",
  ]);
});

test("filterCommitSubjects - drops a stray bare version-number commit", () => {
  const raw = "feat: add widget support\n2.0.0";
  expect(filterCommitSubjects(raw)).toEqual(["feat: add widget support"]);
});

test("filterCommitSubjects - drops blank lines", () => {
  const raw = "feat: add widget support\n\n\nfix: correct off-by-one";
  expect(filterCommitSubjects(raw)).toEqual([
    "feat: add widget support",
    "fix: correct off-by-one",
  ]);
});

test("filterCommitSubjects - empty input yields no subjects", () => {
  expect(filterCommitSubjects("")).toEqual([]);
  expect(filterCommitSubjects("   \n  ")).toEqual([]);
});

test("buildEntry - lists subjects as bullets under a version/date heading", () => {
  const entry = buildEntry("2.0.0", "2026-09-22", [
    "feat: add widget support",
    "fix: correct off-by-one",
  ]);
  expect(entry).toBe(
    "## 2.0.0 - 2026-09-22\n\n- feat: add widget support\n- fix: correct off-by-one\n",
  );
});

test("buildEntry - falls back to a placeholder when there are no subjects", () => {
  const entry = buildEntry("2.0.0", "2026-09-22", []);
  expect(entry).toBe("## 2.0.0 - 2026-09-22\n\n- (no changes recorded)\n");
});

test("mergeChangelogContent - creates the title on the first-ever run", () => {
  const result = mergeChangelogContent(
    null,
    "## 1.0.0 - 2026-01-01\n\n- init\n",
  );
  expect(result).toBe("# Changelog\n\n## 1.0.0 - 2026-01-01\n\n- init\n\n");
});

test("mergeChangelogContent - prepends the new entry above older entries", () => {
  const existing = "# Changelog\n\n## 1.0.0 - 2026-01-01\n\n- init\n";
  const result = mergeChangelogContent(
    existing,
    "## 2.0.0 - 2026-02-01\n\n- feat: add widget support\n",
  );
  expect(result).toBe(
    "# Changelog\n\n## 2.0.0 - 2026-02-01\n\n- feat: add widget support\n\n## 1.0.0 - 2026-01-01\n\n- init\n",
  );
});

test("parsePackageVersion - reads the version field", () => {
  expect(parsePackageVersion('{"name":"pkg","version":"1.2.3"}')).toBe("1.2.3");
});

test("parsePackageVersion - throws when version is missing", () => {
  expect(() => parsePackageVersion('{"name":"pkg"}')).toThrow();
});

test("todayIso - formats a given date as YYYY-MM-DD", () => {
  expect(todayIso(new Date("2026-09-22T15:04:05Z"))).toBe("2026-09-22");
});
