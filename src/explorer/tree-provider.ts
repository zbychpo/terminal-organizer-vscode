import * as terminalBrowserify from '@vscode-utility/terminal-browserify';
import * as os from 'os';
import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { SessionConfiguration } from '../configuration/interface';
import { INHERITABLE_OPTION_KEYS, applyGlobalVariables, mergeScopeConfigurations } from '../utils/scope-merge';
import { getTerminalDescriptionText } from '../utils/terminal-description';
import { extCommands, sysCommands, constants } from '../utils/constants';
import { substituteVariablesDeep } from '../utils/variable-substitution';
import { resolveVscodeVariablesDeep } from '../utils/vscode-variable-resolver';
import { applyEnvironmentToTerminals, resolveEnvironmentVariables, resolveMaskedVariableNames } from '../utils/environment-merge';
import { applyGlobalJoinOperator } from '../utils/join-operator-merge';

var maskEnvValues = (env, maskedNames: Set<string>) => {
  if (!env || !maskedNames || maskedNames.size <= 0) {
    return env;
  }
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, maskedNames.has(key) ? constants.maskedValuePlaceholder : value])
  );
};

var buildResolvedTerminalPreview = (terminal, variable, environmentVariables, globalJoinOperator, maskedNames: Set<string> = new Set(), folderPath?: string) => {
  const terminalWithEnv = applyEnvironmentToTerminals(applyGlobalJoinOperator(terminal, globalJoinOperator), environmentVariables);
  const { commands: commands5, joinOperator, env } = terminalWithEnv;
  const operator = terminalBrowserify.TerminalApi.instance().getJoinOperator(joinOperator);
  const rawCommands = commands5?.join(operator);
  const resolved = substituteVariablesDeep(resolveVscodeVariablesDeep(terminalWithEnv, folderPath), variable);
  return { rawCommands, resolvedCommands: resolved.commands?.join(operator), env, resolvedEnv: maskEnvValues(resolved.env, maskedNames) };
};
// A terminal's multi-line "description" as a markdown block quote (each line
// escaped, so it's shown as typed), or "" when it has none.
var descriptionMarkdown = (terminal, indent = "") => {
  const text = getTerminalDescriptionText(terminal).trim();
  if (!text) {
    return "";
  }
  const quoted = text
    .split("\n")
    .map((line) => `${indent}> ${new vscode.MarkdownString().appendText(line).value}`)
    .join(`  ${os.EOL}`);
  return `${quoted}${os.EOL}${os.EOL}`;
};
// Tags every item in a scope's subtree with that scope's id, so any command
// invoked on it acts on the right sessions.json.
var assignScopeId = (items: TKTreeItem[], scopeId: string) => {
  items.forEach((item) => {
    item.scopeId = scopeId;
    if (item.children) {
      assignScopeId(item.children, scopeId);
    }
  });
  return items;
};
// The terminal's commands joined the way they'll be sent (its own
// joinOperator, else the global one, else the platform default) - without the
// variable resolution buildResolvedTerminalPreview does, so it's cheap enough
// for every item's description.
var getRawCommands = (terminal, globalJoinOperator) => {
  const joinOperator = Object.prototype.hasOwnProperty.call(terminal, "joinOperator") || !globalJoinOperator ? terminal.joinOperator : globalJoinOperator;
  return terminal.commands?.join(terminalBrowserify.TerminalApi.instance().getJoinOperator(joinOperator));
};
export class TKTreeItem extends vscode.TreeItem {
  children?: any[];
  source?: string;
  keywords?: string[];
  sessionId?: string;
  terminalArrayIndex?: number;
  variableName?: string;
  environmentName?: string;
  configValue?: any;
  // The id of the Configuration (workspace folder / workspace-level scope)
  // this item belongs to - commands resolve their sessions.json from it.
  scopeId?: string;
  // Builds the tooltip on hover (TreeProvider.resolveTreeItem) instead of on
  // every refresh - for tooltips that need full variable resolution.
  tooltipFactory?: () => vscode.MarkdownString;

  constructor(label, children2?) {
    super(label, children2 === undefined ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
    this.children = children2;
  }
}
export class TreeProvider implements vscode.TreeDataProvider<TKTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<void>;
  onDidChangeTreeData: vscode.Event<void>;
  getData: () => Promise<TKTreeItem[]>;
  getScopeChildren: (configuration: Configuration) => Promise<TKTreeItem[]>;
  renderScopeItem: (configuration: Configuration) => Promise<TKTreeItem>;
  renderMultiRootModeItem: () => Promise<TKTreeItem>;
  renderGlobalVariablesGroup: () => Promise<TKTreeItem>;
  renderGroupItem: (params: any) => TKTreeItem;
  renderConfigItem: (params: any) => TKTreeItem;
  renderSessionItem: (params: any) => TKTreeItem;
  renderTerminalArrayItem: (params: any) => TKTreeItem;
  renderTerminalItem: (params: any) => TKTreeItem;
  renderVariableItem: (params: any) => TKTreeItem;
  renderEnvironmentItem: (params: any) => TKTreeItem;
  renderEnvironmentVariableItem: (params: any) => TKTreeItem;

  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    // A single scope (the usual single-folder workspace) renders its groups
    // at the top level exactly as before; several scopes (multi-root) get one
    // top-level node each, with the same groups underneath.
    this.getData = () => Configuration.withReadBatch(async () => {
      const scopes = Configuration.all();
      if (scopes.length <= 1) {
        const configuration = scopes[0];
        // Without a sessions file the view stays empty so its welcome
        // content ("Generate Configuration") shows.
        if (!configuration || !(await configuration.isDefinedSessionFile())) {
          return [];
        }
        return [...(await this.getScopeChildren(configuration)), await this.renderGlobalVariablesGroup()];
      }
      const items = [await this.renderMultiRootModeItem()];
      for (const configuration of scopes) {
        items.push(await this.renderScopeItem(configuration));
      }
      items.push(await this.renderGlobalVariablesGroup());
      return items;
    });
    // The user's global variables (user settings), at the bottom of the tree.
    // Each entry notes the projects that override it with their own variable.
    this.renderGlobalVariablesGroup = async () => {
      const globalVariables = Configuration.getGlobalVariables();
      const overriddenIn: Record<string, string[]> = {};
      for (const configuration of Configuration.all()) {
        if (!(await configuration.isDefinedSessionFile())) {
          continue;
        }
        const ownVariable = (await configuration.getSessionConfiguration()).variable || {};
        Object.keys(globalVariables)
          .filter((name) => Object.prototype.hasOwnProperty.call(ownVariable, name))
          .forEach((name) => (overriddenIn[name] = [...(overriddenIn[name] || []), configuration.label]));
      }
      const entries = Object.entries(globalVariables);
      const item = this.renderGroupItem({
        label: constants.globalVariablesGroupLabel,
        icon: { id: "globe" },
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        contextValue: "global-variables-group-context",
        tooltip: new vscode.MarkdownString(`### **${constants.globalVariablesGroupLabel}**${os.EOL}${constants.globalVariablesTooltip}${os.EOL}${os.EOL}`).appendMarkdown(
          entries.length > 0 ? entries.map(([name, value]) => `- **${name}**: \`${value}\``).join(os.EOL) : constants.globalVariablesEmpty
        ),
        children: entries.map(([name, value]) => {
          const child = this.renderVariableItem({ name, value });
          child.contextValue = "global-variable-context";
          child.iconPath = new vscode.ThemeIcon("symbol-variable");
          if (overriddenIn[name]) {
            const note = constants.globalVariableOverriddenIn.replace("{projects}", overriddenIn[name].join(", "));
            child.description = `${value} (${note})`;
            (child.tooltip as vscode.MarkdownString).appendText(note);
          }
          return child;
        })
      });
      item.description = constants.globalVariablesGroupDescription;
      return item;
    };
    // Shows which multiRootMode applies, what it means, and where to change it.
    this.renderMultiRootModeItem = async () => {
      const mode = Configuration.getMultiRootMode();
      const isInherit = mode === "inherit";
      const workspaceScope = Configuration.getWorkspaceScope();
      const label = constants.multiRootModeLabel.replace("{mode}", mode);
      const tooltip = new vscode.MarkdownString(`### **${label}**${os.EOL}${os.EOL}`)
        .appendMarkdown(`- ${isInherit ? "**inherit** (current)" : "inherit"}: ${constants.multiRootModeInheritDescription}${os.EOL}`)
        .appendMarkdown(`- ${isInherit ? "separate" : "**separate** (current)"}, default: ${constants.multiRootModeSeparateDescription}${os.EOL}${os.EOL}`);
      if (isInherit && !workspaceScope) {
        tooltip.appendMarkdown(`⚠ ${constants.multiRootModeNoWorkspaceScope}${os.EOL}${os.EOL}`);
      } else if (isInherit && !(await workspaceScope!.isDefinedSessionFile())) {
        tooltip.appendMarkdown(`⚠ ${constants.multiRootModeNoWorkspaceFile.replace("{workspace}", workspaceScope!.label)}${os.EOL}${os.EOL}`);
      }
      tooltip.appendMarkdown(constants.multiRootModeHowToChange);
      const item = new TKTreeItem(label);
      item.tooltip = tooltip;
      item.description = isInherit ? constants.multiRootModeInheritShort : constants.multiRootModeSeparateShort;
      item.contextValue = "multi-root-mode-context";
      item.iconPath = new vscode.ThemeIcon(isInherit ? "link" : "files");
      item.command = {
        title: "Open the multi-root mode setting",
        command: sysCommands.openSettings,
        arguments: [`${Configuration.wsConfigurationSpace}.multiRootMode`]
      };
      return item;
    };
    this.renderScopeItem = async (configuration) => {
      const isWorkspace = configuration.kind === "workspace";
      const hasFile = await configuration.isDefinedSessionFile();
      const workspaceScope = Configuration.getWorkspaceScope();
      const usesWorkspaceFallback = !hasFile && !isWorkspace && Configuration.getMultiRootMode() === "inherit" && !!workspaceScope && (await workspaceScope.isDefinedSessionFile());
      const item = new TKTreeItem(configuration.label, hasFile ? await this.getScopeChildren(configuration) : undefined);
      if (hasFile) {
        item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      }
      item.description = hasFile
        ? configuration.relativeSessionFilePath
        : usesWorkspaceFallback
          ? constants.scopeUsesWorkspaceConfiguration.replace("{workspace}", workspaceScope!.label)
          : constants.scopeHasNoConfiguration;
      item.tooltip = new vscode.MarkdownString(`### **${configuration.label}**${isWorkspace ? " (workspace)" : ""}`)
        .appendCodeblock(configuration.sessionFilePath)
        .appendText(isWorkspace ? constants.scopeWorkspaceTooltip : "");
      item.contextValue = hasFile ? "scope-context" : "scope-empty-context";
      item.iconPath = new vscode.ThemeIcon(isWorkspace ? "folder-library" : "root-folder");
      item.scopeId = configuration.id;
      return item;
    };
    this.getScopeChildren = async (configuration) => {
      const ownConfig = await configuration.load();
      if (!ownConfig) {
        return [];
      }
      const inheritedConfig = await configuration.loadInherited();
      const config: SessionConfiguration = inheritedConfig ? mergeScopeConfigurations(inheritedConfig, ownConfig) : ownConfig;
      // Global variables only feed the resolved previews (resolvedVariable);
      // they're listed once, in the "Global Variables" group at the bottom of
      // the tree - never in a project's own "Variables" group.
      const previewVariable = applyGlobalVariables(config, Configuration.getGlobalVariables()).variable || {};
      const ownVariable = ownConfig.variable || {};
      const ownEnvironments = ownConfig.environments || {};
      const inheritedKeys = inheritedConfig
        ? INHERITABLE_OPTION_KEYS.filter((key) => !Configuration.isSetOnValue(ownConfig[key]) && Configuration.isSetOnValue(config[key]))
        : [];
      const inheritedFrom = Configuration.getWorkspaceScope()?.label;
      const userConfigKeys = configuration.userConfigKeys;
      const configItem = (params) => this.renderConfigItem({ ...params, userConfigKeys, inheritedFrom: inheritedKeys.includes(params.label) ? inheritedFrom : undefined });
      const folderPath = configuration.folderPath;
      const {
        active = "default",
        activateOnStartup = false,
        keepExistingTerminals = false,
        noClear = false,
        joinOperator = "",
        openNodeOnStart = [],
        theme = "default",
        sessions = [],
        variable = {},
        environments = {},
        activeEnvironment = ""
      } = config;
      const resolvedVariable = resolveVscodeVariablesDeep(previewVariable, folderPath);
      const resolvedActiveEnvironmentVariables = resolveVscodeVariablesDeep(resolveEnvironmentVariables(environments, activeEnvironment), folderPath);
      const activeMaskedNames = resolveMaskedVariableNames(environments, activeEnvironment);
      const killProcess = configuration.getExperimentalConfig("killProcess");
      const isWSLSupport = configuration.getExperimentalConfig("wslSupport");
      const isQuickRun = configuration.getExperimentalConfig("quickRun");
      const isHideCommandsInExplorer = configuration.getExperimentalConfig(
        "hideCommandsInExplorerDescriptions"
      );
      const themeService = new terminalBrowserify.ThemeService(theme);
      return assignScopeId([
        this.renderGroupItem({
          label: "Global Configs",
          icon: { id: "wrench" },
          collapsibleState: openNodeOnStart.includes("Global Configs") ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
          children: [
            configItem({
              label: "active",
              value: active,
              defaultValue: "default",
              description: "Used to determine which session to use."
            }),
            configItem({
              label: "activateOnStartup",
              value: activateOnStartup,
              defaultValue: false,
              description: "Activated the session when Visual Studio Code starts up."
            }),
            configItem({
              label: "keepExistingTerminals",
              value: keepExistingTerminals,
              defaultValue: false,
              description: "Keep existing terminals open when a session is executed."
            }),
            configItem({
              label: "noClear",
              value: noClear,
              defaultValue: false,
              description: `A Boolean variable indicating whether to execute the clear command during initialization.${os.EOL}If the value is true, the clear command will not be executed upon initialization.${os.EOL}If the value is false, the clear command will be executed.`
            }),
            configItem({
              label: "joinOperator",
              value: joinOperator,
              defaultValue: "",
              description: `The default operator used to join a terminal's multiple commands (e.g. ";", "&&", "||") when the terminal doesn't specify its own "joinOperator".${os.EOL}A terminal's own "joinOperator" always overrides this global value. If neither is set, it defaults to "&" on Windows and ";" elsewhere.`
            }),
            configItem({
              label: "theme",
              value: theme,
              defaultValue: "default",
              description: "The theme can either automatically select colors/icons or manually."
            }),
            configItem({
              label: "openNodeOnStart",
              value: openNodeOnStart,
              defaultValue: [],
              description: "List of node names (e.g. \"Sessions\", \"Variables\", \"Environments\", a session name, an environment name, or a split-terminal group name) that will be expanded by default in this explorer view."
            }),
            configItem({
              label: "killProcess",
              value: killProcess,
              defaultValue: false,
              icon: { id: "microscope" },
              description: "Kill the active process when the terminal is closed."
            }),
            configItem({
              label: "wslSupport",
              value: isWSLSupport,
              defaultValue: false,
              icon: { id: "microscope" },
              description: "When enable, will convert wsl path to windows path when connect to WSL."
            }),
            configItem({
              label: "quickRun",
              value: isQuickRun,
              defaultValue: true,
              icon: { id: "microscope" },
              description: "Add a button to quick active session from the terminal tab."
            }),
            configItem({
              label: "hideCommandsInExplorerDescriptions",
              value: isHideCommandsInExplorer,
              defaultValue: false,
              icon: { id: "microscope" },
              description: "Hide the terminal commands in the explorer tree item descriptions."
            })
          ]
        }),
        this.renderGroupItem({
          label: "Sessions",
          icon: { id: "layers" },
          collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
          contextValue: "sessions-group-context",
          children: Object.entries(sessions).map(([sessionName, session]) => {
            return this.renderSessionItem({
              label: sessionName,
              value: session,
              openNodeOnStart,
              hideCommands: isHideCommandsInExplorer,
              children: session.map((terminalOrTerminalArray, index) => {
                if (Array.isArray(terminalOrTerminalArray)) {
                  const terminalGroupName = terminalOrTerminalArray?.[0].name;
                  return this.renderTerminalArrayItem({
                    terminals: terminalOrTerminalArray,
                    sessionId: sessionName,
                    terminalArrayIndex: index,
                    variable: resolvedVariable,
                    environmentVariables: resolvedActiveEnvironmentVariables,
                    maskedNames: activeMaskedNames,
                    joinOperator,
                    folderPath,
                    openNodeOnStart,
                    children: terminalOrTerminalArray.map(
                      (t) => this.renderTerminalItem({
                        terminal: t,
                        theme: themeService,
                        sessionId: sessionName,
                        terminalArrayIndex: index,
                        terminalGroupName,
                        variable: resolvedVariable,
                        environmentVariables: resolvedActiveEnvironmentVariables,
                        maskedNames: activeMaskedNames,
                        joinOperator,
                        folderPath,
                        hideCommands: isHideCommandsInExplorer
                      })
                    )
                  });
                }
                return this.renderTerminalItem({
                  terminal: terminalOrTerminalArray,
                  theme: themeService,
                  sessionId: sessionName,
                  terminalArrayIndex: index,
                  terminalGroupName: terminalOrTerminalArray.name,
                  variable: resolvedVariable,
                  environmentVariables: resolvedActiveEnvironmentVariables,
                  maskedNames: activeMaskedNames,
                  joinOperator,
                  folderPath,
                  hideCommands: isHideCommandsInExplorer
                });
              })
            });
          })
        }),
        this.renderGroupItem({
          label: "Variables",
          icon: { id: "symbol-variable" },
          collapsibleState: openNodeOnStart.includes("Variables") ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
          contextValue: "variables-group-context",
          tooltip: Object.keys(variable).length > 0
            ? new vscode.MarkdownString(`### **Variables**${os.EOL}${Object.entries(variable).map(([name, value]) => `- **${name}**: \`${value}\``).join(os.EOL)}`)
            : new vscode.MarkdownString(`### **Variables**${os.EOL}No variables defined yet.`),
          children: Object.entries(variable).map(([name, value]) =>
            this.renderVariableItem({ name, value, inheritedFrom: Object.prototype.hasOwnProperty.call(ownVariable, name) ? undefined : inheritedFrom })
          )
        }),
        this.renderGroupItem({
          label: "Environments variables",
          icon: { id: "server-environment" },
          collapsibleState: openNodeOnStart.includes("Environments") ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
          contextValue: "environments-group-context",
          tooltip: Object.keys(environments).length > 0
            ? new vscode.MarkdownString(`### **Environments**${os.EOL}${Object.keys(environments).map((name) => `- ${name}${name === activeEnvironment ? " (active)" : ""}`).join(os.EOL)}`)
            : new vscode.MarkdownString(`### **Environments**${os.EOL}No environments defined yet.`),
          children: Object.entries(environments).map(([name, value]) =>
            this.renderEnvironmentItem({
              name,
              value,
              isActive: name === activeEnvironment,
              openNodeOnStart,
              environments,
              inheritedFrom: Object.prototype.hasOwnProperty.call(ownEnvironments, name) ? undefined : inheritedFrom
            })
          )
        })
      ], configuration.id);
    };
    this.renderGroupItem = (params) => {
      const { label, icon, collapsibleState, contextValue, tooltip, children: children2 } = params;
      const { id, color } = icon || {};
      const item = new TKTreeItem(label, children2);
      item.contextValue = contextValue || "overview-context";
      item.iconPath = new vscode.ThemeIcon(id, color);
      if (collapsibleState) {
        item.collapsibleState = collapsibleState;
      }
      if (tooltip) {
        item.tooltip = tooltip;
      }
      return item;
    };
    this.renderConfigItem = (params) => {
      const { label, value, defaultValue, icon, children: children2, description, userConfigKeys = [], inheritedFrom } = params;
      const { id, color } = icon || {};
      const source = userConfigKeys.includes(label) ? "settings.json" : "sessions.json";
      const item = new TKTreeItem(label, children2);
      item.description = inheritedFrom ? `${value} (${constants.inheritedFromLabel.replace("{workspace}", inheritedFrom)})` : `${value}`;
      item.tooltip = new vscode.MarkdownString(`### **${label}**: \`${value}\``).appendText(description ? `${os.EOL}${description}` : "").appendCodeblock(`Default Value: ${defaultValue}`).appendCodeblock(`Config Source: ${inheritedFrom ? `${inheritedFrom} sessions.json (inherited)` : source}`);
      item.contextValue = "config-context";
      item.configValue = value;
      item.iconPath = new vscode.ThemeIcon(id || "circle-filled", color);
      item.source = source;
      item.keywords = source === "settings.json" ? [
        `"${Configuration.wsConfigurationSpace}.${label}": ${value}`,
        `"${Configuration.wsConfigurationSpace}.${label}": "${value}"`
      ] : [`"${label}": ${value}`, `"${label}": "${value}"`];
      item.command = {
        title: "Navigate to configuration",
        command: extCommands.navigateActivity,
        arguments: [item]
      };
      return item;
    };
    this.renderSessionItem = (params) => {
      const { label, value, children: children2, openNodeOnStart = [], hideCommands: hideCommandsInExplorerDescriptions = false } = params;
      const terminalNames = value.map((s) => Array.isArray(s) ? `[${s.map((v) => v.name).join(", ")}]` : s.name);
      const item = new TKTreeItem(label, children2);
      if (!hideCommandsInExplorerDescriptions) {
        item.description = terminalNames.join(", ");
      }
      item.tooltip = new vscode.MarkdownString(`### **${label}**${os.EOL}${terminalNames.map((t) => `- ${t}`).join(os.EOL)}`);
      item.contextValue = "session-context";
      item.iconPath = new vscode.ThemeIcon("versions");
      item.sessionId = label;
      item.collapsibleState = openNodeOnStart.includes(label) ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
      return item;
    };
    this.renderTerminalArrayItem = (params) => {
      const { terminals, children: children2, sessionId, terminalArrayIndex, variable, environmentVariables, maskedNames, joinOperator, folderPath, openNodeOnStart = [] } = params;
      const label = terminals.map((t) => t.name).join(", ");
      const item = new TKTreeItem(`[${label}]`, children2);
      item.description = "";
      item.tooltipFactory = () => new vscode.MarkdownString(`### **[${label}]**${os.EOL}`).appendMarkdown(
        terminals.map((terminal) => {
          const { name, disabled } = terminal;
          const { rawCommands, resolvedCommands, env, resolvedEnv } = buildResolvedTerminalPreview(terminal, variable, environmentVariables, joinOperator, maskedNames, folderPath);
          let section = `- ${name}${disabled ? " (disabled)" : ""}${os.EOL}${descriptionMarkdown(terminal, "  ")}\`\`\`sh${os.EOL}${rawCommands}${os.EOL}\`\`\`${os.EOL}`;
          if (resolvedCommands && resolvedCommands !== rawCommands) {
            section += `  **Resolved command**${os.EOL}\`\`\`sh${os.EOL}${resolvedCommands}${os.EOL}\`\`\`${os.EOL}`;
          }
          if (env && Object.keys(env).length > 0) {
            section += `  **env** (resolved)${os.EOL}\`\`\`json${os.EOL}${JSON.stringify(resolvedEnv, null, 2)}${os.EOL}\`\`\`${os.EOL}`;
          }
          return section;
        }).join(os.EOL)
      );
      item.contextValue = "terminal-array-context";
      item.iconPath = new vscode.ThemeIcon("array");
      item.sessionId = sessionId;
      item.terminalArrayIndex = terminalArrayIndex;
      item.collapsibleState = terminals.some((t) => openNodeOnStart.includes(t.name)) ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
      return item;
    };
    this.renderTerminalItem = (params) => {
      const { terminal, theme, sessionId, terminalArrayIndex, terminalGroupName, variable, environmentVariables, maskedNames, joinOperator, folderPath, hideCommands = false } = params;
      const { name: terminalName = "(empty)" } = terminal;
      const icon = theme.getIcon(terminal.icon, terminalGroupName, terminalName);
      const color = theme.getColor(terminal.color, terminalGroupName, terminalName);
      const item = new TKTreeItem(terminalName);
      if (!hideCommands) {
        item.description = getRawCommands(terminal, joinOperator);
      }
      item.tooltipFactory = () => {
        const { rawCommands: terminalCommands, resolvedCommands, env, resolvedEnv } = buildResolvedTerminalPreview(terminal, variable, environmentVariables, joinOperator, maskedNames, folderPath);
        const tooltip = new vscode.MarkdownString(
          `### **${terminalName}**${terminal.disabled ? " (disabled)" : ""}${os.EOL}${os.EOL}${descriptionMarkdown(terminal)}`
        ).appendCodeblock(`${terminalCommands}`, "sh");
        if (resolvedCommands && resolvedCommands !== terminalCommands) {
          tooltip.appendMarkdown(`${os.EOL}**Resolved command**`).appendCodeblock(`${resolvedCommands}`, "sh");
        }
        if (env && Object.keys(env).length > 0) {
          tooltip.appendMarkdown(`${os.EOL}**env** (resolved)`).appendCodeblock(JSON.stringify(resolvedEnv, null, 2), "json");
        }
        return tooltip;
      };
      item.contextValue = "terminal-context";
      item.iconPath = new vscode.ThemeIcon(icon?.id || "terminal", color);
      item.sessionId = sessionId;
      item.terminalArrayIndex = terminalArrayIndex;
      item.source = "sessions.json";
      item.keywords = [`"name": "${terminalName}"`];
      item.command = {
        title: "Navigate to configuration",
        command: extCommands.navigateActivity,
        arguments: [item]
      };
      return item;
    };
    this.renderVariableItem = (params) => {
      const { name, value, inheritedFrom } = params;
      const item = new TKTreeItem(name);
      item.description = inheritedFrom ? `${value} (${constants.inheritedFromLabel.replace("{workspace}", inheritedFrom)})` : value;
      item.tooltip = new vscode.MarkdownString(`### **${name}**`).appendCodeblock(`${value}`);
      if (inheritedFrom) {
        item.tooltip.appendText(constants.inheritedTooltip.replace("{workspace}", inheritedFrom));
      }
      // Inherited entries live in the workspace-level sessions.json, so the
      // edit/remove actions (which act on this scope's own file) are hidden.
      item.contextValue = inheritedFrom ? "variable-inherited-context" : "variable-context";
      item.iconPath = new vscode.ThemeIcon("symbol-variable");
      item.variableName = name;
      return item;
    };
    this.renderEnvironmentItem = (params) => {
      const { name, value = {}, isActive, openNodeOnStart = [], environments = {}, inheritedFrom } = params;
      const inherits = Array.isArray(value.inherits) ? value.inherits : [];
      const entries = Object.entries(value).filter(([key]) => key !== "inherits" && key !== "mask");
      const ownKeys = new Set(entries.map(([key]) => key));
      const maskedNames = resolveMaskedVariableNames(environments, name);
      const item = new TKTreeItem(
        name,
        entries.map(([key, val]) => this.renderEnvironmentVariableItem({ environmentName: name, name: key, value: val, masked: maskedNames.has(key), inherited: !!inheritedFrom }))
      );
      item.description = [
        isActive ? "active" : "",
        inheritedFrom ? constants.inheritedFromLabel.replace("{workspace}", inheritedFrom) : "",
        inherits.length > 0 ? `inherits: ${inherits.join(", ")}` : ""
      ]
        .filter(Boolean)
        .join(" · ");
      item.tooltipFactory = () => {
        const resolvedEntries = Object.entries(resolveEnvironmentVariables(environments, name));
        return new vscode.MarkdownString(`### **${name}**${isActive ? " (active)" : ""}${os.EOL}`)
        .appendMarkdown(inherits.length > 0 ? `**Inherits** (last wins): ${inherits.join(" → ")}${os.EOL}${os.EOL}` : "")
        .appendMarkdown(
          resolvedEntries.length > 0
            ? `**Resolved variables** (after inheritance)${os.EOL}${resolvedEntries
                .map(([key, val]) => `- **${key}**: \`${maskedNames.has(key) ? constants.maskedValuePlaceholder : val}\`${ownKeys.has(key) ? "" : " _(inherited)_"}`)
                .join(os.EOL)}`
            : "No environment variables defined yet."
        );
      };
      item.contextValue = inheritedFrom ? "environment-inherited-context" : "environment-context";
      item.iconPath = new vscode.ThemeIcon(isActive ? "pass-filled" : "circle-outline", isActive ? new vscode.ThemeColor("terminal.ansiGreen") : undefined);
      item.environmentName = name;
      item.collapsibleState = openNodeOnStart.includes(name) ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
      return item;
    };
    this.renderEnvironmentVariableItem = (params) => {
      const { environmentName, name, value, masked, inherited } = params;
      const displayValue = masked ? constants.maskedValuePlaceholder : value;
      const item = new TKTreeItem(name);
      item.description = displayValue;
      item.tooltip = new vscode.MarkdownString(`### **${name}**`).appendCodeblock(`${displayValue}`);
      item.contextValue = inherited ? "environment-variable-inherited-context" : "environment-variable-context";
      item.iconPath = new vscode.ThemeIcon(masked ? "eye-closed" : "symbol-variable");
      item.environmentName = environmentName;
      item.variableName = name;
      return item;
    };
  }
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  resolveTreeItem(item: vscode.TreeItem, element: TKTreeItem) {
    if (item.tooltip === undefined && element.tooltipFactory) {
      item.tooltip = element.tooltipFactory();
    }
    return item;
  }
  async getChildren(element) {
    if (element === undefined) {
      return await this.getData();
    }
    return element.children;
  }
}
