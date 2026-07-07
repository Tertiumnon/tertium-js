import fs from "node:fs";
import path from "node:path";

function removeTarget(t: string): void {
  const p = path.resolve(process.cwd(), t);
  if (!fs.existsSync(p)) {
    console.log(`Not found (skipping): ${p}`);
    return;
  }

  try {
    // Prefer fs.rmSync with recursive option (Node 14.14+)
    if (typeof fs.rmSync === "function") {
      fs.rmSync(p, { recursive: true, force: true });
    } else {
      // Fallback for older Node versions
      const rimrafLike = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir)) {
          const entryPath = path.join(dir, entry);
          const stat = fs.lstatSync(entryPath);
          if (stat.isDirectory()) rimrafLike(entryPath);
          else fs.unlinkSync(entryPath);
        }
        fs.rmdirSync(dir);
      };
      const stat = fs.lstatSync(p);
      if (stat.isDirectory()) rimrafLike(p);
      else fs.unlinkSync(p);
    }
    console.log(`Deleted: ${p}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to remove ${p}: ${message}`);
    process.exitCode = 1;
  }
}

// Get targets from command line arguments or default to ["dist"]
const args = process.argv.slice(2);
const targets = args.length ? args : ["dist"];

targets.forEach(removeTarget);
