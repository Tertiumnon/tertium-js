import type {
  FrameworkType,
  ScriptCommand,
} from "./improve-start-scripts.types";

export const FRAMEWORK_DETECTION: Record<
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

export const SCRIPT_COMMANDS: Record<FrameworkType, ScriptCommand> = {
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
