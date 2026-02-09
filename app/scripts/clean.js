#!/usr/bin/env node
// Simple cross-platform cleaning script.
// Usage:
//   node scripts/clean.js            # removes ./dist
//   node scripts/clean.js dist build # removes ./dist and ./build

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const targets = args.length ? args : ["dist"];

function removeTarget(t) {
  const p = path.resolve(process.cwd(), t);
  if (!fs.existsSync(p)) {
    console.log(`Not found (skipping): ${p}`);
    return;
  }

  try {
    // Prefer fs.rmSync with recursive option when available (Node 14.14+)
    if (typeof fs.rmSync === "function") {
      fs.rmSync(p, { recursive: true, force: true });
    } else {
      // Fallback for older Node versions: a small recursive remover
      const rimrafLike = (dir) => {
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
    console.error(`Failed to remove ${p}: ${err?.message ? err.message : err}`);
    process.exitCode = 1;
  }
}

targets.forEach(removeTarget);
