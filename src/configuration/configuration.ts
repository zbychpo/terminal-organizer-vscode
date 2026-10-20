import * as fsBrowserify from '@vscode-utility/fs-browserify';
import * as path from 'path';
import * as vscode from 'vscode';
import { SessionConfiguration } from './interface';
import { getWorkspaceRootPath } from '../utils/get-workspace';
import { applyGlobalVariables, mergeScopeConfigurations } from '../utils/scope-merge';
import { getTabWidth } from '../utils/utils';

export type ConfigScopeKind = "workspace" | "folder";
export type MultiRootMode = "separate" | "inherit";

export var WORKSPACE_SCOPE_ID = "workspace";

// One Configuration instance per "scope": every workspace folder gets one
// (backed by its own sessions.json), plus an optional workspace-level one
// next to the saved .code-workspace file in a multi-root workspace. A single
// folder workspace has exactly one scope, at the same path as before
// multi-root support existed (<folder>/.vscode/sessions.json).
export class Configuration {
  static wsConfigurationSpace = "terminal-organizer-vscode";
  static defaultSessionFileLocations = [".vscode/sessions.json", "sessions.json"];
  // Extension settings that control scope discovery rather than describing a
  // session file - kept out of the settings.json -> sessions.json merge in load().
  static nonSessionSettingKeys = ["sessionFileLocations", "multiRootMode", "globalVariables", "logLaunches"];
  private static scopes: Configuration[] = [];
  private static watchRoots: string[] = [];
  // Raw text of each sessions file (undefined = missing/unreadable), keyed by
  // normalized path - only kept while a read batch is open (a tree refresh,
  // see withReadBatch), so one refresh reads each file once instead of once
  // per folder/group, while commands always read the current file from disk.
  // Our own writes and watcher events drop the entry even mid-batch.
  private static fileCache = new Map<string, string | undefined>();
  private static readBatchDepth = 0;
  static refreshDebounceMs = 150;

  readonly id: string;
  readonly kind: ConfigScopeKind;
  readonly label: string;
  readonly folder?: vscode.WorkspaceFolder;
  // Where session files are looked up/created (WSL-translated when wslSupport is on).
  readonly rootPath: string;
  // The folder path used to resolve a relative "cwd" and a bare ${workspaceFolder}.
  readonly folderPath: string;
  readonly vscodeDirPath: string;
  readonly sessionFilePath: string;
  userConfigKeys: string[] = [];

  constructor(params: { id: string; kind: ConfigScopeKind; label: string; folder?: vscode.WorkspaceFolder; rootPath: string; folderPath: string; sessionFilePath: string }) {
    this.id = params.id;
    this.kind = params.kind;
    this.label = params.label;
    this.folder = params.folder;
    this.rootPath = params.rootPath;
    this.folderPath = params.folderPath;
    this.vscodeDirPath = Configuration.getVscodeDirPath(params.rootPath);
    this.sessionFilePath = params.sessionFilePath;
  }

  // ---------------------------------------------------------------------------
  // Scope registry
  // ---------------------------------------------------------------------------

  static async initialize() {
    try {
      await this.discover();
      return this.scopes.length > 0;
    } catch (error) {
      return false;
    }
  }
  static async discover(): Promise<Configuration[]> {
    const folders = vscode.workspace.workspaceFolders || [];
    const isWSLSupport = this.getExperimentalConfig("wslSupport");
    const folderScopes: Configuration[] = [];
    for (const folder of folders) {
      let rootPath = folder.uri.fsPath;
      if (isWSLSupport) {
        rootPath = (await getWorkspaceRootPath(folder.uri)) || rootPath;
      }
      folderScopes.push(
        new Configuration({
          id: folder.uri.toString(),
          kind: "folder",
          label: folder.name,
          folder,
          rootPath,
          folderPath: folder.uri.fsPath,
          sessionFilePath: await this.findSessionFilePath(rootPath)
        })
      );
    }
    const scopes: Configuration[] = [];
    const watchRoots = folderScopes.map((s) => s.rootPath);
    const workspaceDirPath = this.getWorkspaceFileDirPath();
    const isWorkspaceDirAFolder = !!workspaceDirPath && folderScopes.some((s) => this.isSamePath(s.rootPath, workspaceDirPath));
    if (workspaceDirPath && !isWorkspaceDirAFolder) {
      watchRoots.push(workspaceDirPath);
      const workspaceScope = new Configuration({
        id: WORKSPACE_SCOPE_ID,
        kind: "workspace",
        label: path.basename(vscode.workspace.workspaceFile!.fsPath).replace(/\.code-workspace$/i, "") || "Workspace",
        rootPath: workspaceDirPath,
        folderPath: workspaceDirPath,
        sessionFilePath: await this.findSessionFilePath(workspaceDirPath)
      });
      // An empty workspace-level scope is only worth showing when there's more
      // than one folder to share it between.
      if (folderScopes.length > 1 || (await workspaceScope.isDefinedSessionFile())) {
        scopes.push(workspaceScope);
      }
    }
    scopes.push(...folderScopes);
    this.scopes = scopes;
    this.watchRoots = watchRoots;
    return scopes;
  }
  static all(): Configuration[] {
    return this.scopes;
  }
  static get(id?: string): Configuration | undefined {
    return id ? this.scopes.find((s) => s.id === id) : undefined;
  }
  static isMultiScope() {
    return this.scopes.length > 1;
  }
  static getWorkspaceScope(): Configuration | undefined {
    return this.scopes.find((s) => s.kind === "workspace");
  }
  static getMultiRootMode(): MultiRootMode {
    return this.getExperimentalConfig<MultiRootMode>("multiRootMode") === "inherit" ? "inherit" : "separate";
  }
  // The user's global variables (user settings only - the setting is
  // application-scoped), shared by every project in every workspace.
  static getGlobalVariables(): Record<string, string> {
    const value = vscode.workspace.getConfiguration(this.wsConfigurationSpace).inspect<Record<string, string>>("globalVariables")?.globalValue;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  }
  static async setGlobalVariables(variables: Record<string, string>) {
    await vscode.workspace
      .getConfiguration(this.wsConfigurationSpace)
      .update("globalVariables", Object.keys(variables).length > 0 ? variables : undefined, vscode.ConfigurationTarget.Global);
  }
  static getSessionFileLocations(): string[] {
    const locations = this.getExperimentalConfig<string[]>("sessionFileLocations");
    const valid = Array.isArray(locations) ? locations.filter((l) => typeof l === "string" && l.trim() !== "") : [];
    return valid.length > 0 ? valid : this.defaultSessionFileLocations;
  }
  // The scope whose folder contains the given file path (deepest match wins).
  static findScopeByPath(filePath?: string): Configuration | undefined {
    if (!filePath) {
      return undefined;
    }
    const exact = this.scopes.find((s) => this.isSamePath(s.sessionFilePath, filePath));
    if (exact) {
      return exact;
    }
    return this.scopes
      .filter((s) => this.isSubPath(s.folderPath, filePath) || this.isSubPath(s.rootPath, filePath))
      .sort((a, b) => b.folderPath.length - a.folderPath.length)[0];
  }
  // Resolves which scope a command acts on:
  // - a tree item carries its own scopeId,
  // - a Uri (e.g. the Explorer's folder context menu) maps to its folder,
  // - otherwise the only scope, the active editor's scope, or a QuickPick.
  // A scope without a sessions file falls back to the workspace-level one in
  // "inherit" mode, or is skipped in favour of a scope that has a file.
  static async resolve(target?: any, options: { title?: string } = {}): Promise<Configuration | undefined> {
    if (this.scopes.length <= 0) {
      return undefined;
    }
    const fromTarget = target?.scopeId
      ? this.get(target.scopeId)
      : target instanceof vscode.Uri
        ? this.findScopeByPath(target.fsPath)
        : undefined;
    if (fromTarget) {
      return target?.scopeId ? fromTarget : await this.withFallback(fromTarget);
    }
    if (this.scopes.length === 1) {
      return this.scopes[0];
    }
    const fromEditor = this.findScopeByPath(vscode.window.activeTextEditor?.document?.uri?.fsPath);
    if (fromEditor) {
      const resolved = await this.withFallback(fromEditor);
      if (await resolved.isDefinedSessionFile()) {
        return resolved;
      }
    }
    const withFile = await this.filterScopes(true);
    if (withFile.length === 0) {
      return fromEditor || this.scopes[0];
    }
    if (withFile.length === 1) {
      return withFile[0];
    }
    return await this.pickScope(withFile, options.title);
  }
  // Like resolve(), but for creating a new sessions file: prefers scopes that
  // don't have one yet.
  static async resolveForGenerate(target?: any): Promise<Configuration | undefined> {
    if (target?.scopeId) {
      return this.get(target.scopeId);
    }
    if (target instanceof vscode.Uri) {
      return this.findScopeByPath(target.fsPath);
    }
    if (this.scopes.length <= 1) {
      return this.scopes[0];
    }
    const withoutFile = await this.filterScopes(false);
    if (withoutFile.length === 0) {
      return this.scopes[0];
    }
    if (withoutFile.length === 1) {
      return withoutFile[0];
    }
    const fromEditor = this.findScopeByPath(vscode.window.activeTextEditor?.document?.uri?.fsPath);
    const ordered = fromEditor && withoutFile.includes(fromEditor) ? [fromEditor, ...withoutFile.filter((s) => s !== fromEditor)] : withoutFile;
    return await this.pickScope(ordered, "Select where to generate the configuration");
  }
  static async pickScope(scopes: Configuration[], title?: string): Promise<Configuration | undefined> {
    const items = scopes.map((scope) => ({
      label: `$(${scope.kind === "workspace" ? "folder-library" : "root-folder"}) ${scope.label}`,
      description: scope.kind === "workspace" ? "Workspace" : undefined,
      detail: scope.sessionFilePath,
      scope
    }));
    const picked = await vscode.window.showQuickPick(items, {
      title: title || "Select the project",
      placeHolder: "Project...",
      canPickMany: false,
      ignoreFocusOut: true,
      matchOnDetail: true
    });
    return picked?.scope;
  }
  private static async filterScopes(hasFile: boolean) {
    const result: Configuration[] = [];
    for (const scope of this.scopes) {
      if ((await scope.isDefinedSessionFile()) === hasFile) {
        result.push(scope);
      }
    }
    return result;
  }
  private static async withFallback(scope: Configuration): Promise<Configuration> {
    if (scope.kind === "workspace" || this.getMultiRootMode() !== "inherit" || (await scope.isDefinedSessionFile())) {
      return scope;
    }
    const workspaceScope = this.getWorkspaceScope();
    return workspaceScope && (await workspaceScope.isDefinedSessionFile()) ? workspaceScope : scope;
  }
  static getExperimentalConfig<T = any>(key: string): T | undefined {
    return vscode.workspace.getConfiguration(this.wsConfigurationSpace).get<T>(key);
  }
  // Bursts of events (one save often fires 2-3 watcher events, and a command
  // that writes a file and a setting fires both a file and a configuration
  // event) collapse into a single rediscover/refresh after refreshDebounceMs.
  static watch(onConfigChange: () => void): vscode.Disposable {
    let fileWatchers: vscode.Disposable[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: "refresh" | "discover" | "rewatch" | undefined;
    const rank = { refresh: 1, discover: 2, rewatch: 3 };
    const schedule = (kind: "refresh" | "discover" | "rewatch") => {
      if (!pending || rank[kind] > rank[pending]) {
        pending = kind;
      }
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(async () => {
        const kindToRun = pending;
        pending = undefined;
        timer = undefined;
        if (kindToRun === "discover" || kindToRun === "rewatch") {
          await this.discover();
        }
        if (kindToRun === "rewatch") {
          rewatch();
        }
        onConfigChange();
      }, this.refreshDebounceMs);
    };
    const rewatch = () => {
      fileWatchers.forEach((d) => d.dispose());
      const pattern = `{${this.getSessionFileLocations().join(",")}}`;
      fileWatchers = this.watchRoots.map((rootPath) => {
        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(rootPath, pattern));
        // Creating/deleting a file can change which location a scope resolves
        // to (or make a workspace-level scope appear), so rediscover first.
        const onEvent = (kind: "refresh" | "discover") => (uri: vscode.Uri) => {
          this.invalidateFileCache(uri.fsPath);
          schedule(kind);
        };
        return vscode.Disposable.from(
          watcher,
          watcher.onDidCreate(onEvent("discover")),
          watcher.onDidDelete(onEvent("discover")),
          watcher.onDidChange(onEvent("refresh"))
        );
      });
    };
    rewatch();
    const subscriptions = [
      vscode.workspace.onDidChangeWorkspaceFolders(() => schedule("rewatch")),
      vscode.workspace.onDidChangeConfiguration((e) => {
        const ns = this.wsConfigurationSpace;
        if (e.affectsConfiguration(`${ns}.sessionFileLocations`) || e.affectsConfiguration(`${ns}.wslSupport`)) {
          schedule("rewatch");
        } else if (e.affectsConfiguration(ns)) {
          schedule("refresh");
        }
      })
    ];
    return vscode.Disposable.from(...subscriptions, {
      dispose: () => {
        fileWatchers.forEach((d) => d.dispose());
        if (timer) {
          clearTimeout(timer);
        }
      }
    });
  }
  private static async findSessionFilePath(rootPath: string) {
    const locations = this.getSessionFileLocations();
    for (const location of locations) {
      const candidate = path.join(rootPath, location);
      if ((await this.readFileCached(candidate)) !== undefined) {
        return candidate;
      }
    }
    return path.join(rootPath, locations[0]);
  }
  // One readFile instead of the old exists + readFile pair; served from the
  // cache while a read batch is open.
  static async readFileCached(filePath: string): Promise<string | undefined> {
    const key = this.normalizePath(filePath);
    if (this.readBatchDepth > 0 && this.fileCache.has(key)) {
      return this.fileCache.get(key);
    }
    let text: string | undefined;
    try {
      text = await fsBrowserify.fs.readFileAsync(filePath);
    } catch {
      text = undefined;
    }
    if (this.readBatchDepth > 0) {
      this.fileCache.set(key, text);
    }
    return text;
  }
  static async withReadBatch<T>(fn: () => Promise<T>): Promise<T> {
    this.readBatchDepth++;
    try {
      return await fn();
    } finally {
      this.readBatchDepth--;
      if (this.readBatchDepth === 0) {
        this.fileCache.clear();
      }
    }
  }
  static invalidateFileCache(filePath?: string) {
    if (filePath) {
      this.fileCache.delete(this.normalizePath(filePath));
    } else {
      this.fileCache.clear();
    }
  }
  private static getWorkspaceFileDirPath(): string | undefined {
    const { workspaceFile } = vscode.workspace;
    if (!workspaceFile || workspaceFile.scheme !== "file") {
      return undefined;
    }
    return path.dirname(workspaceFile.fsPath);
  }
  private static normalizePath(p: string) {
    const normalized = path.normalize(p).replace(/[\\/]+$/, "");
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
  }
  private static isSamePath(a: string, b: string) {
    return this.normalizePath(a) === this.normalizePath(b);
  }
  private static isSubPath(parent: string, child: string) {
    const relative = path.relative(this.normalizePath(parent), this.normalizePath(child));
    return !relative.startsWith("..") && !path.isAbsolute(relative);
  }
  static getVscodeDirPath(workspaceDirPath) {
    return path.join(workspaceDirPath, ".vscode");
  }

  // ---------------------------------------------------------------------------
  // Per-scope session file access
  // ---------------------------------------------------------------------------

  get isMultiScope() {
    return Configuration.isMultiScope();
  }
  // Whether a terminal without a "cwd" should start in this scope's folder
  // rather than VS Code's default (the first workspace folder, or the
  // terminal.integrated.cwd setting) - only true for the 2nd+ folders of a
  // multi-root workspace, so single-folder behavior is unchanged.
  get ownsDefaultCwd() {
    const folders = vscode.workspace.workspaceFolders || [];
    return this.kind === "folder" && folders.length > 1 && folders[0]?.uri.toString() !== this.id;
  }
  // The sessions file path relative to the scope root, e.g. ".vscode/sessions.json".
  get relativeSessionFilePath() {
    return path.relative(this.rootPath, this.sessionFilePath).replace(/\\/g, "/");
  }
  async load(): Promise<SessionConfiguration> {
    let sessionConfig = await this.getSessionConfiguration();
    const extensionConfig = this.getWorkspaceConfiguration();
    this.userConfigKeys = [];
    Object.entries(extensionConfig).forEach(([key, value]) => {
      if (Configuration.nonSessionSettingKeys.includes(key)) {
        return;
      }
      if (Configuration.isSetOnValue(value)) {
        sessionConfig[key] = value;
        this.userConfigKeys.push(key);
      }
    });
    return sessionConfig;
  }
  // The workspace-level configuration this scope inherits from, when
  // "multiRootMode" is "inherit" and this is a folder scope.
  async loadInherited(): Promise<SessionConfiguration | undefined> {
    if (this.kind !== "folder" || Configuration.getMultiRootMode() !== "inherit") {
      return undefined;
    }
    const workspaceScope = Configuration.getWorkspaceScope();
    if (!workspaceScope || !(await workspaceScope.isDefinedSessionFile())) {
      return undefined;
    }
    return await workspaceScope.load();
  }
  // What actually applies when spawning terminals: load() plus anything
  // inherited from the workspace-level configuration, plus the user's global
  // variables underneath everything. Never save() this back - it would copy
  // inherited/global values into this scope's own file.
  async loadEffective(): Promise<SessionConfiguration> {
    const own = await this.load();
    const inherited = await this.loadInherited();
    return applyGlobalVariables(inherited ? mergeScopeConfigurations(inherited, own) : own, Configuration.getGlobalVariables());
  }
  async save(newestConfig) {
    const isDefinedSessionFile = await this.isDefinedSessionFile();
    if (isDefinedSessionFile) {
      return await this.update(newestConfig);
    }
    return await this.saveNew(newestConfig);
  }
  getExperimentalConfig<T = any>(key: string): T | undefined {
    return this.getWorkspaceConfiguration().get<T>(key);
  }
  async isDefinedSessionFile() {
    return (await Configuration.readFileCached(this.sessionFilePath)) !== undefined;
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
  isUserConfigKey(key: string) {
    const config = this.getWorkspaceConfiguration();
    return config.has(key) && Configuration.isSetOnValue(config.get(key));
  }
  async update(newestConfig) {
    const config = this.getWorkspaceConfiguration();
    const originalContent = await this.getSessionConfiguration();
    let originalContentHasBeenChanged = false;
    const keyValues = Object.entries(newestConfig);
    for (let i = 0; i < keyValues.length; i++) {
      const [key, value] = keyValues[i];
      const isUserConfig = config.has(key) && Configuration.isSetOnValue(config.get(key));
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
  async saveNew(newestConfig) {
    try {
      await fsBrowserify.fs.createDirectoryAsync(path.dirname(this.sessionFilePath));
      await this.writeSessionFile(newestConfig);
      return true;
    } catch {
      return false;
    }
  }
  async writeSessionFile(newestConfig) {
    const text = JSON.stringify(newestConfig, null, getTabWidth());
    try {
      await fsBrowserify.fs.writeFileAsync(this.sessionFilePath, text);
    } finally {
      Configuration.invalidateFileCache(this.sessionFilePath);
    }
  }
  // Folder-scoped settings (e.g. <folder>/.vscode/settings.json) override the
  // workspace's for settings declared with "scope": "resource".
  getWorkspaceConfiguration() {
    return vscode.workspace.getConfiguration(Configuration.wsConfigurationSpace, this.folder?.uri);
  }
  // The file a "settings.json"-sourced value lives in, for navigation.
  getSettingsFilePath() {
    if (this.kind === "workspace" && vscode.workspace.workspaceFile?.scheme === "file") {
      return vscode.workspace.workspaceFile.fsPath;
    }
    return path.join(this.vscodeDirPath, "settings.json");
  }
  // Parses the cached text on every call, so callers always get a fresh
  // object they can mutate (commands splice sessions, load() adds settings).
  async getSessionConfiguration(): Promise<SessionConfiguration> {
    const content = await Configuration.readFileCached(this.sessionFilePath);
    if (content === undefined) {
      return {};
    }
    try {
      return JSON.parse(content) as SessionConfiguration;
    } catch {
      return {};
    }
  }
}
