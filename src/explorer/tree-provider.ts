import * as terminalBrowserify from '@vscode-utility/terminal-browserify';
import * as os from 'os';
import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { extCommands } from '../utils/constants';
import { substituteVariablesDeep } from '../utils/variable-substitution';
import { resolveVscodeVariablesDeep } from '../utils/vscode-variable-resolver';

var buildResolvedTerminalPreview = (terminal, variable) => {
  const { commands: commands5, joinOperator, env } = terminal;
  const operator = terminalBrowserify.TerminalApi.instance().getJoinOperator(joinOperator);
  const rawCommands = commands5?.join(operator);
  const resolved = substituteVariablesDeep(resolveVscodeVariablesDeep(terminal), variable);
  return { rawCommands, resolvedCommands: resolved.commands?.join(operator), env, resolvedEnv: resolved.env };
};
export class TKTreeItem extends vscode.TreeItem {
  children?: any[];
  source?: string;
  keywords?: string[];
  sessionId?: string;
  terminalArrayIndex?: number;
  variableName?: string;

  constructor(label, children2?) {
    super(label, children2 === undefined ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
    this.children = children2;
  }
}
export class TreeProvider implements vscode.TreeDataProvider<TKTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<void>;
  onDidChangeTreeData: vscode.Event<void>;
  getData: () => Promise<TKTreeItem[]>;
  renderGroupItem: (params: any) => TKTreeItem;
  renderConfigItem: (params: any) => TKTreeItem;
  renderSessionItem: (params: any) => TKTreeItem;
  renderTerminalArrayItem: (params: any) => TKTreeItem;
  renderTerminalItem: (params: any) => TKTreeItem;
  renderVariableItem: (params: any) => TKTreeItem;

  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.getData = async () => {
      const isDefinedSessionFile = await Configuration.isDefinedSessionFile();
      if (!isDefinedSessionFile) {
        return [];
      }
      const config = await Configuration.load();
      if (!config) {
        return [];
      }
      const {
        active = "default",
        activateOnStartup = false,
        keepExistingTerminals = false,
        noClear = false,
        theme = "default",
        sessions = [],
        variable = {}
      } = config;
      const resolvedVariable = resolveVscodeVariablesDeep(variable);
      const killProcess = Configuration.getExperimentalConfig("killProcess");
      const isWSLSupport = Configuration.getExperimentalConfig("wslSupport");
      const isQuickRun = Configuration.getExperimentalConfig("quickRun");
      const isHideCommandsInExplorer = Configuration.getExperimentalConfig(
        "hideCommandsInExplorerDescriptions"
      );
      const themeService = new terminalBrowserify.ThemeService(theme);
      return [
        this.renderGroupItem({
          label: "Global Configs",
          icon: { id: "wrench" },
          collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
          children: [
            this.renderConfigItem({
              label: "active",
              value: active,
              defaultValue: "default",
              description: "Used to determine which session to use."
            }),
            this.renderConfigItem({
              label: "activateOnStartup",
              value: activateOnStartup,
              defaultValue: false,
              description: "Activated the session when Visual Studio Code starts up."
            }),
            this.renderConfigItem({
              label: "keepExistingTerminals",
              value: keepExistingTerminals,
              defaultValue: false,
              description: "Keep existing terminals open when a session is executed."
            }),
            this.renderConfigItem({
              label: "noClear",
              value: noClear,
              defaultValue: false,
              description: `A Boolean variable indicating whether to execute the clear command during initialization.${os.EOL}If the value is true, the clear command will not be executed upon initialization.${os.EOL}If the value is false, the clear command will be executed.`
            }),
            this.renderConfigItem({
              label: "theme",
              value: theme,
              defaultValue: "default",
              description: "The theme can either automatically select colors/icons or manually."
            }),
            this.renderConfigItem({
              label: "killProcess",
              value: killProcess,
              defaultValue: false,
              icon: { id: "microscope" },
              description: "Kill the active process when the terminal is closed."
            }),
            this.renderConfigItem({
              label: "wslSupport",
              value: isWSLSupport,
              defaultValue: false,
              icon: { id: "microscope" },
              description: "When enable, will convert wsl path to windows path when connect to WSL."
            }),
            this.renderConfigItem({
              label: "quickRun",
              value: isQuickRun,
              defaultValue: true,
              icon: { id: "microscope" },
              description: "Add a button to quick active session from the terminal tab."
            }),
            this.renderConfigItem({
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
          children: Object.entries(sessions).map(([sessionName, session]) => {
            return this.renderSessionItem({
              label: sessionName,
              value: session,
              children: session.map((terminalOrTerminalArray, index) => {
                if (Array.isArray(terminalOrTerminalArray)) {
                  const terminalGroupName = terminalOrTerminalArray?.[0].name;
                  return this.renderTerminalArrayItem({
                    terminals: terminalOrTerminalArray,
                    sessionId: sessionName,
                    terminalArrayIndex: index,
                    variable: resolvedVariable,
                    children: terminalOrTerminalArray.map(
                      (t) => this.renderTerminalItem({
                        terminal: t,
                        theme: themeService,
                        sessionId: sessionName,
                        terminalArrayIndex: index,
                        terminalGroupName,
                        variable: resolvedVariable
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
                  variable: resolvedVariable
                });
              })
            });
          })
        }),
        this.renderGroupItem({
          label: "Variables",
          icon: { id: "symbol-variable" },
          collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
          contextValue: "variables-group-context",
          tooltip: Object.keys(variable).length > 0
            ? new vscode.MarkdownString(`### **Variables**${os.EOL}${Object.entries(variable).map(([name, value]) => `- **${name}**: \`${value}\``).join(os.EOL)}`)
            : new vscode.MarkdownString(`### **Variables**${os.EOL}No variables defined yet.`),
          children: Object.entries(variable).map(([name, value]) =>
            this.renderVariableItem({ name, value })
          )
        })
      ];
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
      const { label, value, defaultValue, icon, children: children2, description } = params;
      const { id, color } = icon || {};
      const source = Configuration.userConfigKeys.includes(label) ? "settings.json" : "sessions.json";
      const item = new TKTreeItem(label, children2);
      item.description = `${value}`;
      item.tooltip = new vscode.MarkdownString(`### **${label}**: \`${value}\``).appendText(description ? `${os.EOL}${description}` : "").appendCodeblock(`Default Value: ${defaultValue}`).appendCodeblock(`Config Source: ${source}`);
      item.contextValue = "overview-context";
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
      const { label, value, children: children2 } = params;
      const hideCommandsInExplorerDescriptions = Configuration.getExperimentalConfig("hideCommandsInExplorerDescriptions") ?? false;
      const terminalNames = value.map((s) => Array.isArray(s) ? `[${s.map((v) => v.name).join(", ")}]` : s.name);
      const item = new TKTreeItem(label, children2);
      if (!hideCommandsInExplorerDescriptions) {
        item.description = terminalNames.join(", ");
      }
      item.tooltip = new vscode.MarkdownString(`### **${label}**${os.EOL}${terminalNames.map((t) => `- ${t}`).join(os.EOL)}`);
      item.contextValue = "session-context";
      item.iconPath = new vscode.ThemeIcon("versions");
      item.sessionId = label;
      item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      return item;
    };
    this.renderTerminalArrayItem = (params) => {
      const { terminals, children: children2, sessionId, terminalArrayIndex, variable } = params;
      const label = terminals.map((t) => t.name).join(", ");
      const item = new TKTreeItem(`[${label}]`, children2);
      item.description = "";
      item.tooltip = new vscode.MarkdownString(`### **[${label}]**${os.EOL}`).appendMarkdown(
        terminals.map((terminal) => {
          const { name, disabled } = terminal;
          const { rawCommands, resolvedCommands, env, resolvedEnv } = buildResolvedTerminalPreview(terminal, variable);
          let section = `- ${name}${disabled ? " (disabled)" : ""}${os.EOL}\`\`\`sh${os.EOL}${rawCommands}${os.EOL}\`\`\`${os.EOL}`;
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
      item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      return item;
    };
    this.renderTerminalItem = (params) => {
      const { terminal, theme, sessionId, terminalArrayIndex, terminalGroupName, variable } = params;
      const { name: terminalName = "(empty)" } = terminal;
      const icon = theme.getIcon(terminal.icon, terminalGroupName, terminalName);
      const color = theme.getColor(terminal.color, terminalGroupName, terminalName);
      const { rawCommands: terminalCommands, resolvedCommands, env, resolvedEnv } = buildResolvedTerminalPreview(terminal, variable);
      const hideCommandsInExplorerDescriptions = Configuration.getExperimentalConfig("hideCommandsInExplorerDescriptions") ?? false;
      const item = new TKTreeItem(terminalName);
      if (!hideCommandsInExplorerDescriptions) {
        item.description = terminalCommands;
      }
      const tooltip = new vscode.MarkdownString(
        `### **${terminalName}**${terminal.disabled ? " (disabled)" : ""}`
      ).appendCodeblock(`${terminalCommands}`, "sh");
      if (resolvedCommands && resolvedCommands !== terminalCommands) {
        tooltip.appendMarkdown(`${os.EOL}**Resolved command**`).appendCodeblock(`${resolvedCommands}`, "sh");
      }
      if (env && Object.keys(env).length > 0) {
        tooltip.appendMarkdown(`${os.EOL}**env** (resolved)`).appendCodeblock(JSON.stringify(resolvedEnv, null, 2), "json");
      }
      item.tooltip = tooltip;
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
      const { name, value } = params;
      const item = new TKTreeItem(name);
      item.description = value;
      item.tooltip = new vscode.MarkdownString(`### **${name}**`).appendCodeblock(`${value}`);
      item.contextValue = "variable-context";
      item.iconPath = new vscode.ThemeIcon("symbol-variable");
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
  async getChildren(element) {
    if (element === undefined) {
      return await this.getData();
    }
    return element.children;
  }
}
