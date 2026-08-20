import * as terminalBrowserify from '@vscode-utility/terminal-browserify';
import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail, showTextDocument, getSessionQuickPickItems } from '../utils/utils';

var chooseSessionName2 = async (config) => {
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
export var saveAsync = async () => {
  try {
    const isDefinedSessionFile = await Configuration.isDefinedSessionFile();
    if (!isDefinedSessionFile) {
      vscode.window.showWarningMessage(constants.notExistConfiguration);
      return;
    }
    const config = await Configuration.load();
    if (!config) {
      vscode.window.showWarningMessage(constants.notExistConfiguration);
      return;
    }
    let sessionName = await chooseSessionName2(config);
    if (!sessionName) {
      return;
    }
    const session = terminalBrowserify.TerminalApi.instance().getCurrentTerminals();
    if (!config.sessions) {
      config.sessions = {
        default: []
      };
    }
    const newestSessions = { ...config.sessions, ...{ [sessionName]: session } };
    await Configuration.save({ sessions: newestSessions });
    vscode.window.showInformationMessage(constants.saveSessionSuccess, constants.viewConfigurationButton).then((selection) => {
      if (selection === constants.viewConfigurationButton) {
        showTextDocument(Configuration.sessionFilePath);
      }
    });
  } catch (error) {
    showErrorMessageWithDetail(constants.saveSessionFailed, error);
  }
};
