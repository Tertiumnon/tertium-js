import { execSync } from "node:child_process";
import { exit } from "node:process";

type ReleaseType = "patch" | "minor" | "major";

function run(command: string): void {
  try {
    console.log(`> ${command}`);
    execSync(command, { stdio: "inherit" });
  } catch (_error) {
    console.error(`Error executing command: ${command}`);
    exit(1);
  }
}

function getCurrentBranch(): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
    }).trim();
  } catch {
    console.error("Failed to get current branch");
    exit(1);
  }
}

function release(type: ReleaseType): void {
  switch (type) {
    case "patch":
      // Patch release: from main branch
      console.log("\n📋 Starting patch release from main branch...\n");
      run("git checkout main");
      run("git pull");
      run(`npm version ${type}`);
      run("git push");
      run("git push --tags");
      run("git checkout develop");
      run("git pull");
      run("git rebase main");
      run("git push");
      run("git checkout main");
      console.log("\n✅ Patch release complete!\n");
      break;

    case "minor":
    case "major": {
      // Minor and major releases: from develop branch
      console.log(`\n📋 Starting ${type} release from develop branch...\n`);
      const currentBranch = getCurrentBranch();
      if (currentBranch !== "develop") {
        console.error(
          `❌ Error: Must be on 'develop' branch, but currently on '${currentBranch}'`,
        );
        exit(1);
      }
      run("git pull");
      run(`npm version ${type}`);
      run("git push");
      run("git push --tags");
      run("git checkout main");
      run("git pull");
      run("git merge develop");
      run("git push");
      run("git checkout develop");
      run("git pull origin main");
      console.log(`\n✅ ${type} release complete!\n`);
      break;
    }

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

if (!["patch", "minor", "major"].includes(releaseType)) {
  console.error(`Invalid release type: ${releaseType}`);
  console.error("Valid options: patch, minor, major");
  exit(1);
}

release(releaseType as ReleaseType);
