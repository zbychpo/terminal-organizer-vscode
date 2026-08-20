import * as fsBrowserify from '@vscode-utility/fs-browserify';
import * as path from 'path';
import * as vscode from 'vscode';
import { SessionConfiguration } from './interface';
import { getWorkspaceRootPath } from '../utils/get-workspace';
import { getTabWidth } from '../utils/utils';

export class Configuration {
  static wsConfigurationSpace = "terminal-organizer";
  static vscodeDirPath = "";
  static sessionFilePath = "";
  static userConfigKeys = [];

  static async initialize() {
    try {
      let workspaceDirPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      const isWSLSupport = this.getExperimentalConfig("wslSupport");
      if (isWSLSupport) {
        workspaceDirPath = await getWorkspaceRootPath();
      }
      if (!workspaceDirPath) {
        throw Error("Can not resolve workspace directory.");
      }
      this.vscodeDirPath = this.getVscodeDirPath(workspaceDirPath);
      this.sessionFilePath = this.getSessionFilePath(workspaceDirPath);
      return true;
    } catch (error) {
      return false;
    }
  }
  static async load(): Promise<SessionConfiguration> {
    let sessionConfig = await this.getSessionConfiguration();
    const extensionConfig = this.getWorkspaceConfiguration();
    this.userConfigKeys = [];
    Object.entries(extensionConfig).forEach(([key, value]) => {
      if (this.isSetOnValue(value)) {
        sessionConfig[key] = value;
        this.userConfigKeys.push(key);
      }
    });
    return sessionConfig;
  }
  static async save(newestConfig) {
    const isDefinedSessionFile = await this.isDefinedSessionFile();
    if (isDefinedSessionFile) {
      return await this.update(newestConfig);
    }
    return await this.saveNew(newestConfig);
  }
  static getExperimentalConfig<T = any>(key: string): T | undefined {
    const extensionConfig = this.getWorkspaceConfiguration();
    return extensionConfig.get<T>(key);
  }
  static watch(onConfigChange) {
    fsBrowserify.fs.watch(this.sessionFilePath).onDidCreate(() => {
      onConfigChange();
    });
    fsBrowserify.fs.watch(this.sessionFilePath).onDidChange(() => {
      onConfigChange();
    });
    fsBrowserify.fs.watch(this.sessionFilePath).onDidDelete(() => {
      onConfigChange();
    });
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("terminal-organizer")) {
        onConfigChange();
      }
    });
  }
  static async isDefinedSessionFile() {
    return await fsBrowserify.fs.existAsync(this.sessionFilePath);
  }
  static isSetOnValue(value) {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === "string" || value instanceof String) {
      return value !== "";
    }
    if (typeof value === "boolean" || value === true || value === false) {
      return true;
    }
    if (typeof value === "number") {
      return true;
    }
    return true;
  }
  static async update(newestConfig) {
    const config = this.getWorkspaceConfiguration();
    const originalContent = await this.getSessionConfiguration();
    let originalContentHasBeenChanged = false;
    const keyValues = Object.entries(newestConfig);
    for (let i = 0; i < keyValues.length; i++) {
      const [key, value] = keyValues[i];
      const isUserConfig = config.has(key) && this.isSetOnValue(config.get(key));
      if (isUserConfig) {
        await config.update(key, value);
      } else {
        if (originalContent && originalContent.hasOwnProperty(key)) {
          originalContent[key] = value;
          originalContentHasBeenChanged = true;
        }
      }
    }
    if (originalContentHasBeenChanged) {
      try {
        await this.writeSessionFile(originalContent);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
  static async saveNew(newestConfig) {
    try {
      await fsBrowserify.fs.createDirectoryAsync(this.vscodeDirPath);
      await this.writeSessionFile(newestConfig);
      return true;
    } catch {
      return false;
    }
  }
  static async writeSessionFile(newestConfig) {
    await fsBrowserify.fs.writeFileAsync(this.sessionFilePath, JSON.stringify(newestConfig, null, getTabWidth()));
  }
  static getWorkspaceConfiguration() {
    return vscode.workspace.getConfiguration(this.wsConfigurationSpace);
  }
  static async getSessionConfiguration(): Promise<SessionConfiguration> {
    const sessionFileExist = await fsBrowserify.fs.existAsync(this.sessionFilePath);
    if (!sessionFileExist) {
      return {};
    }
    try {
      const content = await fsBrowserify.fs.readFileAsync(this.sessionFilePath);
      return JSON.parse(content) as SessionConfiguration;
    } catch {
      return {};
    }
  }
  static getVscodeDirPath(workspaceDirPath) {
    return path.join(workspaceDirPath, ".vscode");
  }
  static getSessionFilePath(workspaceDirPath) {
    const vscodeDirPath = this.getVscodeDirPath(workspaceDirPath);
    return path.join(vscodeDirPath, "sessions.json");
  }
}
