import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

export var removeEnvironmentVariableAsync = async (environmentVariableTreeItem) => {
  try {
    const { environmentName, variableName } = environmentVariableTreeItem || {};
    if (!environmentName || !variableName || variableName === "inherits" || variableName === "mask") {
      return;
    }
    const currentContent = await Configuration.getSessionConfiguration();
    const environments = currentContent.environments || {};
    const environment = { ...(environments[environmentName] || {}) };
    delete environment[variableName];
    if (Array.isArray(environment.mask) && environment.mask.includes(variableName)) {
      const updatedMask = environment.mask.filter((name) => name !== variableName);
      if (updatedMask.length > 0) {
        environment.mask = updatedMask;
      } else {
        delete environment.mask;
      }
    }
    await Configuration.writeSessionFile({
      ...currentContent,
      environments: { ...environments, [environmentName]: environment }
    });
    vscode.window.showInformationMessage(constants.removeEnvironmentVariableSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.removeEnvironmentVariableFailed, error);
  }
};
