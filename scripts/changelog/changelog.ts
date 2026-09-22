#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CHANGELOG_FILE_NAME } from "./changelog.constants";
import {
  buildEntry,
  filterCommitSubjects,
  mergeChangelogContent,
  parsePackageVersion,
  todayIso,
} from "./changelog.utils";

function run(command: string): string {
  return execSync(command, { encoding: "utf-8" }).trim();
}

// null means "no tags yet" (first-ever release) - a real condition to handle,
// not an error to swallow, so only this specific git failure is caught.
function previousTag(): string | null {
  try {
    return run("git describe --tags --abbrev=0");
  } catch {
    return null;
  }
}

function commitSubjectsSince(tag: string | null): string[] {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const rawLog = run(`git log ${range} --no-merges --pretty=format:%s`);
  return filterCommitSubjects(rawLog);
}

function readPackageVersion(projectDir: string): string {
  const pkgPath = path.join(projectDir, "package.json");
  return parsePackageVersion(readFileSync(pkgPath, "utf-8"));
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const projectDir = process.cwd();
const changelogPath = path.join(projectDir, CHANGELOG_FILE_NAME);

const version = readPackageVersion(projectDir);
const date = todayIso();
const tag = previousTag();
const subjects = commitSubjectsSince(tag);
const entry = buildEntry(version, date, subjects);

if (dryRun) {
  console.log(entry);
} else {
  const existing = existsSync(changelogPath)
    ? readFileSync(changelogPath, "utf-8")
    : null;
  writeFileSync(changelogPath, mergeChangelogContent(existing, entry));
  console.log(`✅ ${CHANGELOG_FILE_NAME} updated for ${version}`);
}
