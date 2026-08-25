import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

export var removeEnvironmentVariableAsync = async (environmentVariableTreeItem) => {
  try {
    const { environmentName, variableName } = environmentVariableTreeItem || {};
    if (!environmentName || !variableName) {
      return;
    }
    const currentContent = await Configuration.getSessionConfiguration();
    const environments = currentContent.environments || {};
    const environment = { ...(environments[environmentName] || {}) };
    delete environment[variableName];
    await Configuration.writeSessionFile({
      ...currentContent,
      environments: { ...environments, [environmentName]: environment }
    });
    vscode.window.showInformationMessage(constants.removeEnvironmentVariableSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.removeEnvironmentVariableFailed, error);
  }
};
