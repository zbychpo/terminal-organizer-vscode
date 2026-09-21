import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

export var duplicateEnvironmentActivityAsync = async (environmentTreeItem) => {
  try {
    const { environmentName } = environmentTreeItem || {};
    if (!environmentName) {
      return;
    }
    const currentContent = await Configuration.getSessionConfiguration();
    const environments = currentContent.environments || {};
    if (!Object.prototype.hasOwnProperty.call(environments, environmentName)) {
      return;
    }
    let suggestedName = `${environmentName} (copy)`;
    let counter = 2;
    while (Object.prototype.hasOwnProperty.call(environments, suggestedName)) {
      suggestedName = `${environmentName} (copy ${counter})`;
      counter++;
    }
    const name = await vscode.window.showInputBox({
      title: constants.enterDuplicateEnvironmentNameTitle,
      placeHolder: constants.enterEnvironmentNamePlaceHolder,
      value: suggestedName,
      valueSelection: [0, suggestedName.length],
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
    await Configuration.writeSessionFile({
      ...currentContent,
      environments: { ...environments, [name]: { ...environments[environmentName] } }
    });
    vscode.window.showInformationMessage(constants.duplicateEnvironmentSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.duplicateEnvironmentFailed, error);
  }
};
