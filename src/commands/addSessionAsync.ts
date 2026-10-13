import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail, isWorkspaceOpened, showGenerateConfiguration } from '../utils/utils';

export var addSessionAsync = async () => {
  try {
    if (!isWorkspaceOpened()) {
      vscode.window.showWarningMessage(constants.openWorkspace);
      return;
    }
    const isDefinedSessionFile = await Configuration.isDefinedSessionFile();
    if (!isDefinedSessionFile) {
      await showGenerateConfiguration();
      return;
    }
    const config = await Configuration.load();
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
    await Configuration.save({ sessions: { ...sessions, [name]: [] } });
    vscode.window.showInformationMessage(constants.addSessionSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.addSessionFailed, error);
  }
};
