export interface BwSecret {
  env: string;
  name: string;
}

export interface BwItem {
  object: string;
  id: string;
  type: number;
  name: string;
  login: Record<string, unknown>;
  fields?: BwField[];
  notes?: string;
}

export interface BwField {
  type: number;
  name: string;
  value: string;
}

export interface BwStatus {
  authenticated: boolean;
  locked: boolean;
}

export interface EnvVars {
  [key: string]: string;
}

export interface ProjectConfig {
  [project: string]: BwSecret[];
}
