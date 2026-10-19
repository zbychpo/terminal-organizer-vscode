import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

export var removeEnvironmentAsync = async (environmentTreeItem) => {
  try {
    const { environmentName } = environmentTreeItem || {};
    if (!environmentName) {
      return;
    }
    const configuration = await Configuration.resolve(environmentTreeItem);
    if (!configuration) {
      return;
    }
    const currentContent = await configuration.getSessionConfiguration();
    const environments = { ...(currentContent.environments || {}) };
    delete environments[environmentName];
    const activeEnvironment = currentContent.activeEnvironment === environmentName ? "" : currentContent.activeEnvironment;
    await configuration.writeSessionFile({ ...currentContent, environments, activeEnvironment });
    vscode.window.showInformationMessage(constants.removeEnvironmentSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.removeEnvironmentFailed, error);
  }
};
