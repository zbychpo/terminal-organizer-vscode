import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { SessionConfiguration } from '../configuration/interface';
import { constants } from '../utils/constants';
import { updateStatusBar } from '../utils/show-status-bar';
import { showErrorMessageWithDetail, showTextDocument, getSessionQuickPickItems } from '../utils/utils';

export var removeAsync = async () => {
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
    const { active, sessions } = config;
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
    if (active === selectedSession) {
      newestConfiguration.active = constants.defaultSession;
      updateStatusBar(newestConfiguration.active);
    }
    await Configuration.save(newestConfiguration);
    vscode.window.showInformationMessage(constants.removeSessionSuccess, constants.viewConfigurationButton).then((selection) => {
      if (selection === constants.viewConfigurationButton) {
        showTextDocument(Configuration.sessionFilePath);
      }
    });
  } catch (error) {
    showErrorMessageWithDetail(constants.removeSessionFailed, error);
  }
};
