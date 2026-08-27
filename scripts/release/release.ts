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

// `npm version <type>` refuses to run at all if the working tree isn't clean (it needs
// to create a commit containing only the version bump), failing with "Git working
// directory not clean" - deep inside the release flow, easy to miss among all the other
// git/npm output, and the symptom looks confusingly like "the script didn't change the
// version" rather than "you have uncommitted changes". Check for this up front, before
// touching any branches, so the actual problem is unmissable.
function checkCleanWorkingTree(): void {
  const status = execSync("git status --porcelain", { encoding: "utf-8" });
  if (status.trim()) {
    console.error(
      "❌ Error: working tree has uncommitted changes - `npm version` refuses to run " +
        "until they're committed (or stashed), and the rest of this script would " +
        "silently never reach the version bump either. Commit or stash first:\n",
    );
    console.error(status);
    exit(1);
  }
}

function release(type: ReleaseType): void {
  checkCleanWorkingTree();

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
