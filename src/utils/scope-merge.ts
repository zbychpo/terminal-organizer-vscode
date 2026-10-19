import * as path from 'path';

// Top-level options a folder's sessions.json inherits from the workspace-level
// one (multiRootMode: "inherit") when it doesn't set them itself.
export var INHERITABLE_OPTION_KEYS = ["theme", "keepExistingTerminals", "noClear", "joinOperator", "activeEnvironment"];

var isUnset = (value) => value === undefined || value === null || value === "";

// Merges a workspace-level configuration (base) under a folder's own one:
// "variable" and "environments" are merged key by key with the folder winning,
// inheritable options fall back to the base when the folder leaves them unset,
// and "sessions" are never merged - each scope keeps only its own sessions, so
// a session name is never ambiguous.
export var mergeScopeConfigurations = (base, own) => {
  const merged = { ...(own || {}) };
  if (!base) {
    return merged;
  }
  INHERITABLE_OPTION_KEYS.forEach((key) => {
    if (isUnset(merged[key]) && !isUnset(base[key])) {
      merged[key] = base[key];
    }
  });
  if (base.variable || merged.variable) {
    merged.variable = { ...(base.variable || {}), ...(merged.variable || {}) };
  }
  if (base.environments || merged.environments) {
    merged.environments = { ...(base.environments || {}), ...(merged.environments || {}) };
  }
  return merged;
};

// Puts the user's global variables (terminal-organizer-vscode.globalVariables
// in the user settings) under a configuration's own "variable": they're
// available to every project, and any project-level variable with the same
// name wins.
export var applyGlobalVariables = (config, globalVariables) => {
  if (!globalVariables || Object.keys(globalVariables).length <= 0) {
    return config;
  }
  return { ...(config || {}), variable: { ...globalVariables, ...(config?.variable || {}) } };
};

// Makes every relative "cwd" in a session (standalone terminals and
// split-terminal groups alike) absolute against the scope's folder, so a
// terminal defined in a second workspace folder doesn't resolve its cwd
// against the first one. With fillMissing, a terminal without any "cwd"
// starts in that folder too (instead of VS Code's default, the first folder).
export var resolveRelativeCwdDeep = (input, folderPath, fillMissing = false) => {
  if (!folderPath) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => resolveRelativeCwdDeep(item, folderPath, fillMissing));
  }
  if (!input || typeof input !== "object") {
    return input;
  }
  const { cwd } = input;
  if (typeof cwd === "string" && cwd !== "") {
    return path.isAbsolute(cwd) ? input : { ...input, cwd: path.join(folderPath, cwd) };
  }
  return fillMissing && (cwd === undefined || cwd === "") ? { ...input, cwd: folderPath } : input;
};
