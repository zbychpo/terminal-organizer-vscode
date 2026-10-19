import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { pickVariableValue } from '../utils/pick-variable-value';
import { showErrorMessageWithDetail, isWorkspaceOpened, showGenerateConfiguration } from '../utils/utils';

export var addVariableAsync = async (target?) => {
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
    const currentContent = await configuration.getSessionConfiguration();
    const variable = currentContent.variable || {};
    const name = await vscode.window.showInputBox({
      title: constants.enterVariableNameTitle,
      placeHolder: constants.enterVariableNamePlaceHolder,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return constants.variableNameNotEmpty;
        }
        if (Object.prototype.hasOwnProperty.call(variable, value)) {
          return constants.variableNameIsDuplicated;
        }
        return "";
      }
    });
    if (!name) {
      return;
    }
    const value = await pickVariableValue("");
    if (value === undefined) {
      return;
    }
    // Writes the raw file directly instead of configuration.save(), which
    // only ever updates keys that already exist in the file - "variable"
    // wouldn't exist yet on any sessions.json generated before this feature.
    await configuration.writeSessionFile({
      ...currentContent,
      variable: { ...variable, [name]: value }
    });
    vscode.window.showInformationMessage(constants.addVariableSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.addVariableFailed, error);
  }
};
