export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

export interface PackageJson {
  name?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
