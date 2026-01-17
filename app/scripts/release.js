#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */

const { execSync } = require("node:child_process");
const { exit } = require("node:process");

/**
 * Execute a command and print its output
 * @param {string} command - Command to execute
 */
function run(command) {
  try {
    console.log(`> ${command}`);
    execSync(command, { stdio: "inherit" });
  } catch (_error) {
    console.error(`Error executing command: ${command}`);
    exit(1);
  }
}

/**
 * Release a new version
 * @param {'patch'|'minor'|'major'} type - Release type
 */
function release(type) {
  switch (type) {
    case "patch":
      // Patch release: from main branch
      run("git checkout main");
      run(`npm version ${type}`);
      run("git push");
      run("git push --tags");
      run("git checkout develop");
      run("git rebase main");
      run("git push");
      run("git checkout main");
      break;

    case "minor":
    case "major":
      // Minor and major releases: from develop branch
      run("git checkout develop");
      run(`npm version ${type}`);
      run("git push");
      run("git push --tags");
      run("git checkout main");
      run("git merge develop");
      run("git push");
      run("git checkout develop");
      break;

    default:
      console.error("Invalid release type. Use: patch, minor, or major");
      exit(1);
  }
}

// Get release type from command line arguments
const releaseType = process.argv[2];
if (!releaseType) {
  console.error("Please specify release type: patch, minor, or major");
  exit(1);
}

release(releaseType);
