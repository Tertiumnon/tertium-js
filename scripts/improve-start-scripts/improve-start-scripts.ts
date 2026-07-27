import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  FrameworkType,
  PackageJson,
  ScriptCommand,
} from "./improve-start-scripts.types";

const FRAMEWORK_DETECTION: Record<
  string,
  { patterns: string[]; type: FrameworkType }
> = {
  "solid-js": {
    patterns: ["solid-js", "vite-plugin-solid"],
    type: "vite-solidjs",
  },
  react: { patterns: ["react", "react-dom"], type: "vite-react" },
  vue: { patterns: ["vue"], type: "vite-vue" },
  angular: { patterns: ["@angular/core"], type: "angular" },
  "react-scripts": { patterns: ["react-scripts"], type: "react-scripts" },
};

const SCRIPT_COMMANDS: Record<FrameworkType, ScriptCommand> = {
  "vite-solidjs": {
    dev: "vite",
    start: "vite preview",
    description: "SolidJS with Vite",
  },
  "vite-react": {
    dev: "vite",
    start: "vite preview",
    description: "React with Vite",
  },
  "vite-vue": {
    dev: "vite",
    start: "vite preview",
    description: "Vue with Vite",
  },
  "vite-generic": {
    dev: "vite",
    start: "vite preview",
    description: "Generic Vite project",
  },
  angular: {
    dev: "ng serve",
    start: "ng serve",
    description: "Angular",
  },
  "react-scripts": {
    dev: "react-scripts start",
    start: "react-scripts start",
    description: "Create React App",
  },
  unknown: {
    dev: "node .",
    start: "node .",
    description: "Unknown framework (fallback)",
  },
};

const detectFramework = (pkg: PackageJson): FrameworkType => {
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  // Check for Vite first, then frameworks
  const hasVite = "vite" in allDeps;

  for (const [dep, config] of Object.entries(FRAMEWORK_DETECTION)) {
    const hasAnyPattern = config.patterns.some((pattern) => pattern in allDeps);
    if (!hasAnyPattern) continue;

    if (dep === "solid-js" && hasVite) return "vite-solidjs";
    if (dep === "react" && hasVite) return "vite-react";
    if (dep === "vue" && hasVite) return "vite-vue";
    if (dep === "angular") return "angular";
    if (dep === "react-scripts") return "react-scripts";
  }

  // Fallback to Vite if it's present
  if (hasVite) return "vite-generic";

  return "unknown";
};

const improveStartScripts = (
  projectPath: string,
  options: { update?: boolean; force?: boolean } = {},
): void => {
  const packageJsonPath = path.join(projectPath, "package.json");

  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    const pkg: PackageJson = JSON.parse(content);

    const framework = detectFramework(pkg);
    const commands = SCRIPT_COMMANDS[framework];

    if (!pkg.scripts) {
      pkg.scripts = {};
    }

    const hasStart = "start" in pkg.scripts;
    const hasDev = "dev" in pkg.scripts;
    const needsUpdate = !hasStart || !hasDev || options.force;

    console.log(`\n📦 Project: ${projectPath}`);
    console.log(`🔍 Framework: ${commands.description}`);
    console.log(
      `✓ Scripts: ${hasStart ? "start" : "⚠️  missing start"} | ${hasDev ? "dev" : "⚠️  missing dev"}`,
    );

    if (!needsUpdate) {
      console.log("✅ Scripts already configured");
      return;
    }

    if (options.update || options.force) {
      if (!hasStart) {
        pkg.scripts["start"] = commands.start;
        console.log(`✏️  Added "start" → "${commands.start}"`);
      }

      if (!hasDev) {
        pkg.scripts["dev"] = commands.dev;
        console.log(`✏️  Added "dev" → "${commands.dev}"`);
      }

      writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
      console.log("✅ package.json updated");
    } else {
      console.log("\n💡 To update scripts, run with --update flag");
      console.log(`   Suggested start: "${commands.start}"`);
      console.log(`   Suggested dev: "${commands.dev}"`);
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      console.error(`❌ package.json not found: ${packageJsonPath}`);
    } else if (err instanceof SyntaxError) {
      console.error(`❌ Invalid package.json: ${packageJsonPath}`);
    } else {
      console.error(`❌ Error: ${err.message}`);
    }
    process.exit(1);
  }
};

// CLI handling
const projectPath = process.argv[2] || process.cwd();
const shouldUpdate = process.argv.includes("--update");
const forceUpdate = process.argv.includes("--force");

if (process.argv.includes("--help")) {
  console.log(`
Usage: improve-start-scripts.ts [projectPath] [options]

Options:
  --update      Update package.json with suggested scripts
  --force       Force update even if scripts already exist
  --help        Show this help message

Examples:
  # Check current project
  bun scripts/improve-start-scripts/improve-start-scripts.ts

  # Check specific project
  bun scripts/improve-start-scripts/improve-start-scripts.ts ./some-project

  # Update current project
  bun scripts/improve-start-scripts/improve-start-scripts.ts --update

  # Force update
  bun scripts/improve-start-scripts/improve-start-scripts.ts /path/to/project --force
`);
  process.exit(0);
}

improveStartScripts(projectPath, { update: shouldUpdate, force: forceUpdate });
