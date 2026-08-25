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
    const currentContent = await Configuration.getSessionConfiguration();
    const environments = { ...(currentContent.environments || {}) };
    delete environments[environmentName];
    const activeEnvironment = currentContent.activeEnvironment === environmentName ? "" : currentContent.activeEnvironment;
    await Configuration.writeSessionFile({ ...currentContent, environments, activeEnvironment });
    vscode.window.showInformationMessage(constants.removeEnvironmentSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.removeEnvironmentFailed, error);
  }
};
