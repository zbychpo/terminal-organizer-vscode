import * as path from 'path';
import * as vscode from 'vscode';
import { glob } from 'glob';
import { extractAntCommands } from './modules/antParse';
import { extractGradleCommands } from './modules/gradleParse';
import { extractGruntCommands } from './modules/gruntParse';
import { extractGulpCommands } from './modules/gulpParse';
import { extractJsonScriptCommands } from './modules/jsonScriptParse';
import { extractMakeCommands } from './modules/makeParse';
import { extractPipenvCommands } from './modules/pipenvParse';
import { Configuration } from '../configuration/configuration';
import { configurationTemplate } from '../configuration/template';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail, getSessionQuickPickItems } from '../utils/utils';

var getGlobFiles = (fileType) => {
  switch (fileType) {
    case "npm":
      return ["**/package.json"];
    case "composer":
      return ["**/composer.json"];
    case "make":
      return ["**/[Mm]akefile"];
    case "gradle":
      return ["**/*.[Gg][Rr][Aa][Dd][Ll][Ee]"];
    case "pipenv":
      return ["**/[Pp][Ii][Pp][Ff][Ii][Ll][Ee]"];
    case "ant":
      return ["**/[Bb][Uu][Ii][Ll][Dd].[Xx][Mm][Ll]"];
    case "grunt":
      return ["**/[Gg][Rr][Uu][Nn][Tt][Ff][Ii][Ll][Ee].[Jj][Ss]"];
    case "gulp":
      return [
        "**/[Gg][Uu][Ll][Pp][Ff][Ii][Ll][Ee].{[Jj][Ss],[Tt][Ss],[Mm][Jj][Ss],[Bb][Aa][Bb][Ee][Ll].[Jj][Ss]}"
      ];
    default:
      return undefined;
  }
};
var getCommands = async (fileType, filePath) => {
  switch (fileType) {
    case "npm":
      return extractJsonScriptCommands(filePath);
    case "composer":
      return extractJsonScriptCommands(filePath);
    case "make":
      return extractMakeCommands(filePath);
    case "gradle":
      return extractGradleCommands(filePath);
    case "pipenv":
      return extractPipenvCommands(filePath);
    case "ant":
      return extractAntCommands(filePath);
    case "grunt":
      return extractGruntCommands(filePath);
    case "gulp":
      return extractGulpCommands(filePath);
    default:
      return undefined;
  }
};
var getFilePaths = async (workspaceFolders, globFiles) => {
  const filePaths = [];
  for (let i = 0; i < workspaceFolders.length; i++) {
    const wsFolder = workspaceFolders[i];
    for (let j = 0; j < globFiles.length; j++) {
      const globFile = globFiles[j];
      const files = await glob(globFile, {
        cwd: wsFolder.uri.fsPath,
        nodir: true,
        absolute: true,
        ignore: "**/node_modules/**"
      });
      filePaths.push(...files);
    }
  }
  return filePaths;
};
var chooseFilePath = async (filePaths) => {
  let selectedFilePath = filePaths[0];
  if (filePaths.length >= 1) {
    const options: vscode.QuickPickItem[] = filePaths.map((filePath) => {
      const dirname2 = path.dirname(filePath);
      const filename = path.basename(filePath);
      return { label: filename, detail: dirname2 };
    });
    const quickPickItem = await vscode.window.showQuickPick(options, {
      title: constants.selectFileTitle,
      placeHolder: constants.selectFilePlaceHolder,
      canPickMany: false,
      ignoreFocusOut: true
    });
    return quickPickItem ? path.join(quickPickItem.detail || "", quickPickItem.label) : undefined;
  }
  return selectedFilePath;
};
var chooseSessionName = async () => {
  const config = await Configuration.load();
  if (!config.sessions) {
    config.sessions = { default: [] };
  }
  const sessionsWithDescription = getSessionQuickPickItems(config.sessions);
  sessionsWithDescription.forEach((sessionItem) => {
    sessionItem.detail = `Overwrites scripts to session ${sessionItem.label}`;
  });
  const addNewSession: vscode.QuickPickItem = {
    label: "Add new session...",
    detail: "Create new session, and save scripts to it.",
    alwaysShow: true
  };
  const quickPickItem = await vscode.window.showQuickPick([addNewSession, ...sessionsWithDescription], {
    title: "Select the session you want to override or add new session",
    placeHolder: "Session name...",
    ignoreFocusOut: true
  });
  if (!quickPickItem) {
    return undefined;
  }
  let sessionName = quickPickItem.label;
  if (sessionName === addNewSession.label) {
    const sessionNameInput = await vscode.window.showInputBox({
      title: "Please enter the session name.",
      placeHolder: "e.g. build, migrate, start, deploy",
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return "The session name cannot be null or empty.";
        }
        if (sessionsWithDescription.some((s) => s.label === value)) {
          return "The session name already exists.";
        }
        return "";
      }
    });
    return sessionNameInput ? sessionNameInput : undefined;
  }
  return sessionName;
};
export var importAsync = async (fileType) => {
  try {
    const { workspaceFolders } = vscode.workspace;
    if (!workspaceFolders || workspaceFolders.length <= 0) {
      vscode.window.showWarningMessage(constants.openWorkspace);
      return;
    }
    const globFiles = getGlobFiles(fileType);
    if (!globFiles || globFiles.length <= 0) {
      vscode.window.showWarningMessage(constants.notSupportFileType.replace("{fileType}", fileType));
      return;
    }
    const filePaths = await getFilePaths(workspaceFolders, globFiles);
    if (!filePaths || filePaths.length <= 0) {
      vscode.window.showWarningMessage(
        constants.notExistImportFile.replace("{fileType}", fileType).replace("{workspace}", workspaceFolders.map((w) => w.uri.fsPath).join(", "))
      );
      return;
    }
    let selectedFilePath = await chooseFilePath(filePaths);
    if (!selectedFilePath) {
      return;
    }
    const scripts = await getCommands(fileType, selectedFilePath);
    if (!scripts) {
      vscode.window.showWarningMessage(constants.notExistAnyCommands.replace("{filePath}", selectedFilePath));
      return;
    }
    const cwd = path.dirname(selectedFilePath);
    const terminalItems = Object.entries(scripts).map(([name, commands5]) => {
      const item = { name, cwd, commands: commands5 };
      return item;
    });
    let sessionName = await chooseSessionName();
    if (!sessionName) {
      return;
    }
    const isDefinedSessionFile = await Configuration.isDefinedSessionFile();
    if (!isDefinedSessionFile) {
      await Configuration.save({ ...configurationTemplate, sessions: { default: [] } });
    }
    const config = await Configuration.load();
    if (!config.sessions) {
      config.sessions = { default: [] };
    }
    const previousTerminalItems = config.sessions[sessionName] || [];
    config.sessions[sessionName] = previousTerminalItems.concat(terminalItems);
    await Configuration.save(config);
  } catch (error) {
    showErrorMessageWithDetail(constants.importFileFailed.replace("{fileType}", fileType), error);
  }
};
