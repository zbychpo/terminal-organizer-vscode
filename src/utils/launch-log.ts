import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from './constants';
import { resolveEnvironmentVariables, resolveMaskedVariableNames } from './environment-merge';
import { INHERITABLE_OPTION_KEYS } from './scope-merge';
import { resolveVariableReferences } from './variable-substitution';
import { resolveVscodeVariablesDeep } from './vscode-variable-resolver';

// "Terminal Organizer" output channel: when terminal-organizer-vscode.logLaunches
// is on, every session/terminal launch writes what was started, with which
// parameters, and where each value came from (project sessions.json,
// workspace-level sessions.json, settings.json, global variables, an
// environment, or a default). Masked environment values stay masked.

var channel: vscode.LogOutputChannel | undefined;
var VARIABLE_TOKEN = /\$\{variable:([^}]+)\}/g;
var ANY_TOKEN = /\$\{[^}]+\}/g;
var LOGGED_OPTIONS = ["theme", "keepExistingTerminals", "noClear", "joinOperator", "activeEnvironment"];

export var getLogChannel = () => {
  if (!channel) {
    channel = vscode.window.createOutputChannel("Terminal Organizer", { log: true });
  }
  return channel;
};
export var showLog = () => getLogChannel().show(true);
export var isLaunchLogEnabled = () => !!Configuration.getExperimentalConfig<boolean>("logLaunches");

var has = (object, key) => !!object && Object.prototype.hasOwnProperty.call(object, key);
var collectVariableNames = (value, into: Set<string>) => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  for (const match of text.matchAll(VARIABLE_TOKEN)) {
    into.add(match[1]);
  }
  return into;
};
var collectUnresolvedTokens = (value, into: Set<string>) => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  for (const match of text.matchAll(ANY_TOKEN)) {
    into.add(match[0]);
  }
  return into;
};

// Which environment in the active environment's "inherits" chain supplies
// a key - mirrors resolveEnvironmentVariables(): own keys win, then later
// entries in "inherits" over earlier ones, recursively.
export var findEnvironmentSource = (environments, name, key, ancestors: string[] = []): string | undefined => {
  if (!name || !has(environments, name) || ancestors.includes(name)) {
    return undefined;
  }
  const environment = environments[name] || {};
  if (key !== "inherits" && key !== "mask" && has(environment, key)) {
    return name;
  }
  const inherits = Array.isArray(environment.inherits) ? environment.inherits : [];
  for (let i = inherits.length - 1; i >= 0; i--) {
    const found = findEnvironmentSource(environments, inherits[i], key, [...ancestors, name]);
    if (found) {
      return found;
    }
  }
  return undefined;
};

var formatValue = (value) => (typeof value === "string" ? value : JSON.stringify(value));

export type LaunchLogParams = {
  configuration: Configuration;
  // What was launched, e.g. 'session "dev"' or 'terminal "api" (session "dev")'.
  title: string;
  effectiveConfig: any;
  // Terminals before and after resolution, flattened, in the same order.
  rawTerminals: any[];
  resolvedTerminals: any[];
  // Indexes (into resolvedTerminals) whose cwd didn't exist and was replaced
  // by fallbackCwd.
  cwdFallbacks?: Set<number>;
  fallbackCwd?: string;
};

export var logLaunch = async (params: LaunchLogParams) => {
  if (!isLaunchLogEnabled()) {
    return;
  }
  try {
    const { configuration, title, effectiveConfig, rawTerminals, resolvedTerminals, cwdFallbacks = new Set<number>(), fallbackCwd } = params;
    const log = getLogChannel();
    const rawOwn = await configuration.getSessionConfiguration();
    const ownLoaded = await configuration.load();
    const inherited = (await configuration.loadInherited()) || {};
    const userConfigKeys = configuration.userConfigKeys || [];
    const globalVariables = Configuration.getGlobalVariables();
    const workspaceLabel = Configuration.getWorkspaceScope()?.label || "workspace";
    const projectFile = `project ${configuration.relativeSessionFilePath}`;
    const workspaceFile = `workspace-level sessions.json (${workspaceLabel})`;

    const optionSource = (key) => {
      if (userConfigKeys.includes(key)) {
        return "settings.json";
      }
      if (has(rawOwn, key) && Configuration.isSetOnValue(rawOwn[key])) {
        return projectFile;
      }
      if (INHERITABLE_OPTION_KEYS.includes(key) && Configuration.isSetOnValue(inherited[key]) && Configuration.isSetOnValue(effectiveConfig[key])) {
        return workspaceFile;
      }
      return "default";
    };
    const variableSource = (name) => {
      const layers = [
        has(ownLoaded.variable, name) ? projectFile : undefined,
        has(inherited.variable, name) ? workspaceFile : undefined,
        has(globalVariables, name) ? "global variables (user settings)" : undefined
      ].filter(Boolean);
      if (layers.length === 0) {
        return undefined;
      }
      return layers.length > 1 ? `${layers[0]} (overrides ${layers.slice(1).join(", ")})` : layers[0];
    };

    const environments = effectiveConfig.environments || {};
    const activeEnvironment = effectiveConfig.activeEnvironment || "";
    const activeEnvironmentVariables = resolveEnvironmentVariables(environments, activeEnvironment);
    const maskedNames = resolveMaskedVariableNames(environments, activeEnvironment);
    const environmentLabel = (name) => (has(rawOwn.environments, name) ? `"${name}"` : `"${name}" (${workspaceFile})`);
    const resolvedVariables = resolveVariableReferences(resolveVscodeVariablesDeep(effectiveConfig.variable || {}, configuration.folderPath)) || {};
    // A variable feeding a masked environment value is just as secret.
    const maskedVariableNames = new Set<string>();
    maskedNames.forEach((key: string) => collectVariableNames(activeEnvironmentVariables[key], maskedVariableNames));
    const mask = (isMasked, value) => (isMasked ? constants.maskedValuePlaceholder : formatValue(value));

    log.info(`Launching ${title} in project "${configuration.label}"`);
    log.appendLine(`  sessions file:   ${configuration.sessionFilePath}`);
    if (Configuration.isMultiScope()) {
      const workspaceScope = Configuration.getWorkspaceScope();
      const mode = Configuration.getMultiRootMode();
      log.appendLine(`  multiRootMode:   ${mode}${mode === "inherit" && workspaceScope ? ` (workspace-level: ${workspaceScope.sessionFilePath})` : ""}`);
    }
    log.appendLine(
      `  options:         ${LOGGED_OPTIONS.filter((key) => key !== "activeEnvironment")
        .map((key) => `${key}=${formatValue(effectiveConfig[key] ?? "")} (${optionSource(key)})`)
        .join(", ")}`
    );
    if (activeEnvironment) {
      const inherits = environments[activeEnvironment]?.inherits;
      log.appendLine(
        `  environment:     ${environmentLabel(activeEnvironment)} (activeEnvironment from ${optionSource("activeEnvironment")})${
          Array.isArray(inherits) && inherits.length > 0 ? ` → inherits: ${inherits.join(", ")}` : ""
        }`
      );
    } else {
      log.appendLine(`  environment:     (none)`);
    }

    rawTerminals.forEach((rawTerminal, index) => {
      const resolved = resolvedTerminals[index] || {};
      log.appendLine(`  ▸ terminal "${rawTerminal?.name ?? resolved.name ?? "(empty)"}"${rawTerminal?.disabled ? " (disabled - not started)" : ""}`);
      const rawCwd = rawTerminal?.cwd;
      if (cwdFallbacks.has(index)) {
        log.appendLine(`      cwd:         ${rawCwd ?? "(none)"} → not found, using ${fallbackCwd || "VS Code default"}`);
      } else if (!resolved.cwdPath && resolved.cwd) {
        log.appendLine(`      cwd:         ${rawCwd !== resolved.cwd ? `${rawCwd} → ` : ""}${resolved.cwd} → not found, using VS Code default`);
        log.warn(`terminal "${rawTerminal?.name}": cwd "${resolved.cwd}" doesn't exist`);
      } else {
        log.appendLine(`      cwd:         ${rawCwd !== undefined && rawCwd !== resolved.cwdPath ? `${rawCwd} → ` : ""}${resolved.cwdPath || "(VS Code default)"}`);
      }
      const joinOperator = resolved.joinOperator;
      const rawCommands = (rawTerminal?.commands || []).join(" ");
      const resolvedCommands = (resolved.commands || []).join(" ");
      log.appendLine(`      commands:    ${rawCommands !== resolvedCommands ? `${rawCommands} → ` : ""}${resolvedCommands || "(none)"}`);
      if (joinOperator) {
        log.appendLine(`      joinOperator: ${joinOperator} (${has(rawTerminal, "joinOperator") ? "terminal" : optionSource("joinOperator")})`);
      }
      if (resolved.shellPath || resolved.shellArgs) {
        log.appendLine(`      shell:       ${resolved.shellPath || "(default)"}${resolved.shellArgs ? ` ${formatValue(resolved.shellArgs)}` : ""}`);
      }

      // Variables used by this terminal (directly, through its env, or through other variables).
      const used = collectVariableNames(rawTerminal, new Set<string>());
      Object.keys(activeEnvironmentVariables)
        .filter((key) => !has(rawTerminal?.env, key))
        .forEach((key) => collectVariableNames(activeEnvironmentVariables[key], used));
      const queue = [...used];
      while (queue.length > 0) {
        collectVariableNames((effectiveConfig.variable || {})[queue.shift()!], new Set<string>()).forEach((ref) => {
          if (!used.has(ref)) {
            used.add(ref);
            queue.push(ref);
          }
        });
      }
      if (used.size > 0) {
        log.appendLine(`      variables:`);
        [...used].forEach((name) => {
          const source = variableSource(name);
          log.appendLine(
            source
              ? `        ${name} = ${mask(maskedVariableNames.has(name), resolvedVariables[name])}   ← ${source}`
              : `        ${name}   ← NOT DEFINED (left as \${variable:${name}})`
          );
        });
      }

      const envKeys = Object.keys(resolved.env || {});
      if (envKeys.length > 0) {
        log.appendLine(`      env:`);
        envKeys.forEach((key) => {
          const fromTerminal = has(rawTerminal?.env, key);
          const environmentSource = fromTerminal ? undefined : findEnvironmentSource(environments, activeEnvironment, key);
          const isMasked = !fromTerminal && maskedNames.has(key);
          const source = fromTerminal
            ? "terminal's own env"
            : environmentSource
              ? `environment ${environmentLabel(environmentSource)}${environmentSource !== activeEnvironment ? ` (via ${activeEnvironment})` : ""}`
              : "unknown";
          log.appendLine(`        ${key} = ${mask(isMasked, resolved.env[key])}   ← ${source}`);
        });
      }

      const unresolved = collectUnresolvedTokens({ cwd: resolved.cwd, commands: resolved.commands, env: resolved.env, shellPath: resolved.shellPath, shellArgs: resolved.shellArgs }, new Set<string>());
      if (unresolved.size > 0) {
        log.warn(`terminal "${rawTerminal?.name}": unresolved placeholders ${[...unresolved].join(", ")} (unknown name, typo, or circular reference)`);
      }
    });
  } catch (error) {
    getLogChannel().error(`Failed to write the launch log: ${error instanceof Error ? error.message : error}`);
  }
};
