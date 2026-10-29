import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { SessionConfiguration } from '../configuration/interface';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

export var duplicateSessionActivityAsync = async (sessionTreeItem) => {
  try {
    const { sessionId } = sessionTreeItem || {};
    if (!sessionId) {
      return;
    }
    const configuration = await Configuration.resolve(sessionTreeItem);
    if (!configuration) {
      return;
    }
    const config = await configuration.load();
    const sessions = config?.sessions;
    if (!sessions?.[sessionId]) {
      return;
    }
    let suggestedName = `${sessionId} (copy)`;
    let counter = 2;
    while (Object.prototype.hasOwnProperty.call(sessions, suggestedName)) {
      suggestedName = `${sessionId} (copy ${counter})`;
      counter++;
    }
    const name = await vscode.window.showInputBox({
      title: constants.enterDuplicateSessionNameTitle,
      placeHolder: constants.enterSessionNamePlaceHolder,
      value: suggestedName,
      valueSelection: [0, suggestedName.length],
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return constants.sessionNameNotEmpty;
        }
        if (Object.prototype.hasOwnProperty.call(sessions, value)) {
          return constants.sessionNameIsDuplicated;
        }
        return "";
      }
    });
    if (!name) {
      return;
    }
    const newestConfiguration: Partial<SessionConfiguration> = {
      sessions: { ...sessions, [name]: JSON.parse(JSON.stringify(sessions[sessionId])) }
    };
    const sessionEnvironments = config.sessionEnvironments;
    if (Array.isArray(sessionEnvironments?.[sessionId])) {
      newestConfiguration.sessionEnvironments = { ...sessionEnvironments, [name]: [...sessionEnvironments[sessionId]] };
    }
    await configuration.save(newestConfiguration);
    vscode.window.showInformationMessage(constants.duplicateSessionSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.duplicateSessionFailed, error);
  }
};
