export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

export interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
