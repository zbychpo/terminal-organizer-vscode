import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail, isWorkspaceOpened, showGenerateConfiguration } from '../utils/utils';

export var addSessionAsync = async (target?) => {
  try {
    if (!isWorkspaceOpened()) {
      vscode.window.showWarningMessage(constants.openWorkspace);
      return;
    }
    const configuration = await Configuration.resolve(target);
    if (!configuration) {
      return;
    }
    const isDefinedSessionFile = await configuration.isDefinedSessionFile();
    if (!isDefinedSessionFile) {
      await showGenerateConfiguration(configuration);
      return;
    }
    const config = await configuration.load();
    const sessions = config.sessions || {};
    const name = await vscode.window.showInputBox({
      title: constants.enterSessionNameTitle,
      placeHolder: constants.enterSessionNamePlaceHolder,
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
    await configuration.save({ sessions: { ...sessions, [name]: [] } });
    vscode.window.showInformationMessage(constants.addSessionSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.addSessionFailed, error);
  }
};
