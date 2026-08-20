import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { pickVariableValue } from '../utils/pick-variable-value';
import { showErrorMessageWithDetail, isWorkspaceOpened, showGenerateConfiguration } from '../utils/utils';

export var addVariableAsync = async () => {
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
    // Writes the raw file directly instead of Configuration.save(), which
    // only ever updates keys that already exist in the file - "variable"
    // wouldn't exist yet on any sessions.json generated before this feature.
    await Configuration.writeSessionFile({
      ...currentContent,
      variable: { ...variable, [name]: value }
    });
    vscode.window.showInformationMessage(constants.addVariableSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.addVariableFailed, error);
  }
};
