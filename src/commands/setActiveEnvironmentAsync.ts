import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

export var setActiveEnvironmentAsync = async (environmentTreeItem) => {
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
    const activeEnvironment = currentContent.activeEnvironment === environmentName ? "" : environmentName;
    await configuration.writeSessionFile({ ...currentContent, activeEnvironment });
  } catch (error) {
    showErrorMessageWithDetail(constants.setActiveEnvironmentFailed, error);
  }
};
