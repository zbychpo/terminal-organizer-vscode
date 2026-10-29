import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { SessionConfiguration } from '../configuration/interface';
import { constants } from '../utils/constants';
import { updateStatusBar } from '../utils/show-status-bar';
import { showErrorMessageWithDetail, showTextDocument, getSessionQuickPickItems } from '../utils/utils';

export var removeAsync = async (target?) => {
  try {
    const configuration = await Configuration.resolve(target);
    if (!configuration) {
      return;
    }
    const isDefinedSessionFile = await configuration.isDefinedSessionFile();
    if (!isDefinedSessionFile) {
      vscode.window.showWarningMessage(constants.notExistConfiguration);
      return;
    }
    const config = await configuration.load();
    if (!config) {
      vscode.window.showWarningMessage(constants.notExistConfiguration);
      return;
    }
    const { active, sessions, sessionEnvironments } = config;
    if (!sessions) {
      vscode.window.showWarningMessage(constants.notExistAnySessions);
      return;
    }
    let selectedSession = active;
    const sessionsWithDescription = getSessionQuickPickItems(sessions);
    const quickPickItem = await vscode.window.showQuickPick(sessionsWithDescription, {
      title: constants.selectSessionRemoveTitle,
      placeHolder: constants.selectSessionRemovePlaceHolder,
      canPickMany: false,
      ignoreFocusOut: true
    });
    if (!quickPickItem) {
      return;
    }
    selectedSession = quickPickItem.label;
    if (selectedSession === constants.defaultSession) {
      vscode.window.showWarningMessage(constants.couldNotRemoveDefaultSession);
      return;
    }
    const newestConfiguration: Partial<SessionConfiguration> = {};
    newestConfiguration.sessions = sessions;
    if (newestConfiguration.sessions?.[selectedSession]) {
      delete newestConfiguration.sessions[selectedSession];
    }
    if (sessionEnvironments?.[selectedSession]) {
      const { [selectedSession]: _removed, ...rest } = sessionEnvironments;
      newestConfiguration.sessionEnvironments = rest;
    }
    if (active === selectedSession) {
      newestConfiguration.active = constants.defaultSession;
      updateStatusBar(newestConfiguration.active);
    }
    await configuration.save(newestConfiguration);
    vscode.window.showInformationMessage(constants.removeSessionSuccess, constants.viewConfigurationButton).then((selection) => {
      if (selection === constants.viewConfigurationButton) {
        showTextDocument(configuration.sessionFilePath);
      }
    });
  } catch (error) {
    showErrorMessageWithDetail(constants.removeSessionFailed, error);
  }
};
