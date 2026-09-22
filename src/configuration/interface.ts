export type TerminalThemeName = "default" | "inkwell" | "chaos" | "tribe" | "iconic" | "neon" | "solarized" | "dice";

export interface EnvironmentItem {
  // Names of other environments to merge in before this environment's own variables,
  // listed from least to most important - a later entry overrides an earlier one.
  inherits?: string[];
  [variableName: string]: string | string[] | undefined;
}

export interface SessionConfiguration {
  $schema?: string;
  theme?: TerminalThemeName;
  active?: string;
  activateOnStartup?: boolean;
  keepExistingTerminals?: boolean;
  noClear?: boolean;
  joinOperator?: string;
  openNodeOnStart?: string[];
  variable?: Record<string, string>;
  environments?: Record<string, EnvironmentItem>;
  activeEnvironment?: string;
  sessions?: Record<string, any[]>;
  [key: string]: any;
}

export var configFileVersions = {
  v1: "/v1/",
  v2: "/v2/",
  v3: "/v3/",
  v4: "/v4/",
  v5: "/v5/",
  v6: "/v6/",
  v7: "/v7/",
  v8: "/v8/",
  v9: "/v9/",
  v10: "/v10/",
  latest: "/v11/"
};
