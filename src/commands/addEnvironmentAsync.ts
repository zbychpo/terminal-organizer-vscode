import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail, isWorkspaceOpened, showGenerateConfiguration } from '../utils/utils';

export var addEnvironmentAsync = async () => {
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
    const currentContent = await Configuration.getSessionConfiguration();
    const environments = currentContent.environments || {};
    const name = await vscode.window.showInputBox({
      title: constants.enterEnvironmentNameTitle,
      placeHolder: constants.enterEnvironmentNamePlaceHolder,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return constants.environmentNameNotEmpty;
        }
        if (Object.prototype.hasOwnProperty.call(environments, value)) {
          return constants.environmentNameIsDuplicated;
        }
        return "";
      }
    });
    if (!name) {
      return;
    }
    // Writes the raw file directly instead of Configuration.save(), which
    // only ever updates keys that already exist in the file - "environments"
    // wouldn't exist yet on any sessions.json generated before this feature.
    await Configuration.writeSessionFile({
      ...currentContent,
      environments: { ...environments, [name]: {} }
    });
    vscode.window.showInformationMessage(constants.addEnvironmentSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.addEnvironmentFailed, error);
  }
};
