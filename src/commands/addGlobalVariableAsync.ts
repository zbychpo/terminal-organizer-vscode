import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { pickVariableValue } from '../utils/pick-variable-value';
import { showErrorMessageWithDetail } from '../utils/utils';

export var addGlobalVariableAsync = async () => {
  try {
    const variables = Configuration.getGlobalVariables();
    const name = await vscode.window.showInputBox({
      title: constants.enterGlobalVariableNameTitle,
      placeHolder: constants.enterVariableNamePlaceHolder,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return constants.variableNameNotEmpty;
        }
        if (Object.prototype.hasOwnProperty.call(variables, value)) {
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
    await Configuration.setGlobalVariables({ ...variables, [name]: value as string });
    vscode.window.showInformationMessage(constants.addGlobalVariableSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.addGlobalVariableFailed, error);
  }
};
