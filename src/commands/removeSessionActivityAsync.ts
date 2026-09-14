import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { SessionConfiguration } from '../configuration/interface';
import { constants } from '../utils/constants';
import { updateStatusBar } from '../utils/show-status-bar';
import { showErrorMessageWithDetail } from '../utils/utils';

export var removeSessionActivityAsync = async (sessionTreeItem) => {
  try {
    const { sessionId } = sessionTreeItem || {};
    if (!sessionId) {
      return;
    }
    if (sessionId === constants.defaultSession) {
      vscode.window.showWarningMessage(constants.couldNotRemoveDefaultSession);
      return;
    }
    const config = await Configuration.load();
    if (!config?.sessions) {
      return;
    }
    const { active, sessions } = config;
    const newestConfiguration: Partial<SessionConfiguration> = { sessions };
    delete newestConfiguration.sessions[sessionId];
    if (active === sessionId) {
      newestConfiguration.active = constants.defaultSession;
      updateStatusBar(newestConfiguration.active);
    }
    await Configuration.save(newestConfiguration);
    vscode.window.showInformationMessage(constants.removeSessionSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.removeSessionFailed, error);
  }
};
