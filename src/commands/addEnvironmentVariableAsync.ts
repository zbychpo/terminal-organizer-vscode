import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { pickVariableValue } from '../utils/pick-variable-value';
import { showErrorMessageWithDetail } from '../utils/utils';

export var addEnvironmentVariableAsync = async (environmentTreeItem) => {
  try {
    const { environmentName } = environmentTreeItem || {};
    if (!environmentName) {
      return;
    }
    const currentContent = await Configuration.getSessionConfiguration();
    const environments = currentContent.environments || {};
    const environment = environments[environmentName] || {};
    const name = await vscode.window.showInputBox({
      title: constants.enterEnvironmentVariableNameTitle,
      placeHolder: constants.enterEnvironmentVariableNamePlaceHolder,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return constants.environmentVariableNameNotEmpty;
        }
        if (Object.prototype.hasOwnProperty.call(environment, value)) {
          return constants.environmentVariableNameIsDuplicated;
        }
        return "";
      }
    });
    if (!name) {
      return;
    }
    const value = await pickVariableValue("", {
      title: constants.pickEnvironmentVariableValueTitle,
      placeholder: constants.pickEnvironmentVariableValuePlaceHolder
    });
    if (value === undefined) {
      return;
    }
    await Configuration.writeSessionFile({
      ...currentContent,
      environments: { ...environments, [environmentName]: { ...environment, [name]: value } }
    });
    vscode.window.showInformationMessage(constants.addEnvironmentVariableSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.addEnvironmentVariableFailed, error);
  }
};
