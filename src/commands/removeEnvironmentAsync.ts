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
    // Drop it from the sessions/terminals it was assigned to.
    const withoutRemoved = (names) => (Array.isArray(names) ? names.filter((name) => name !== environmentName) : names);
    Object.values(currentContent.sessions || {}).forEach((session: any[]) => {
      (session || []).flat().forEach((terminal) => {
        if (Array.isArray(terminal?.environments)) {
          terminal.environments = withoutRemoved(terminal.environments);
          if (terminal.environments.length === 0) {
            delete terminal.environments;
          }
        }
      });
    });
    if (currentContent.sessionEnvironments) {
      currentContent.sessionEnvironments = Object.fromEntries(
        Object.entries(currentContent.sessionEnvironments)
          .map(([sessionName, names]) => [sessionName, withoutRemoved(names)])
          .filter(([, names]) => !Array.isArray(names) || names.length > 0)
      );
    }
    await configuration.writeSessionFile({ ...currentContent, environments, activeEnvironment });
    vscode.window.showInformationMessage(constants.removeEnvironmentSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.removeEnvironmentFailed, error);
  }
};
