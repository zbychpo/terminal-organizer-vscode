import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

var VARIABLE_TOKEN_PATTERN = /\$\{([^}]+)\}/g;

// A bare ${workspaceFolder} resolves to defaultFolderPath when given (the
// folder of the sessions.json being resolved, in a multi-root workspace),
// otherwise to the first workspace folder.
var getWorkspaceFolderPath = (name, defaultFolderPath?) => {
  const { workspaceFolders } = vscode.workspace;
  if (name) {
    const found = workspaceFolders?.find((folder) => folder.name === name);
    return found ? found.uri.fsPath : undefined;
  }
  if (defaultFolderPath) {
    return defaultFolderPath;
  }
  if (!workspaceFolders || workspaceFolders.length <= 0) {
    return undefined;
  }
  return workspaceFolders[0].uri.fsPath;
};

export var resolveVscodeVariable = (value, defaultFolderPath?: string) => {
  if (typeof value !== "string") {
    return value;
  }
  return value.replace(VARIABLE_TOKEN_PATTERN, (match, token) => {
    const [name, arg] = token.split(":");
    switch (name) {
      case "workspaceFolder": {
        const folderPath = getWorkspaceFolderPath(arg, defaultFolderPath);
        return folderPath ?? match;
      }
      case "workspaceFolderBasename": {
        const folderPath = getWorkspaceFolderPath(arg, defaultFolderPath);
        return folderPath ? path.basename(folderPath) : match;
      }
      case "userHome":
        return os.homedir();
      case "pathSeparator":
      case "/":
        return path.sep;
      case "env":
        return arg !== undefined && process.env[arg] !== undefined ? process.env[arg] : match;
      default:
        // Leaves anything it doesn't recognise untouched - most notably
        // "${variable:NAME}", which utils/variable-substitution.ts resolves
        // in a separate pass.
        return match;
    }
  });
};

export var resolveVscodeVariablesDeep = (input, defaultFolderPath?: string) => {
  if (typeof input === "string") {
    return resolveVscodeVariable(input, defaultFolderPath);
  }
  if (Array.isArray(input)) {
    return input.map((item) => resolveVscodeVariablesDeep(item, defaultFolderPath));
  }
  if (input && typeof input === "object") {
    const result = {};
    Object.entries(input).forEach(([key, value]) => {
      result[key] = resolveVscodeVariablesDeep(value, defaultFolderPath);
    });
    return result;
  }
  return input;
};
