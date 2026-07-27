export interface PackageJson {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
}

export type FrameworkType =
  | "vite-solidjs"
  | "vite-react"
  | "vite-vue"
  | "vite-generic"
  | "angular"
  | "react-scripts"
  | "unknown";

export interface ScriptCommand {
  dev: string;
  start: string;
  description: string;
}
