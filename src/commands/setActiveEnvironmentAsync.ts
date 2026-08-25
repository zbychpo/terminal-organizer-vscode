import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

export var setActiveEnvironmentAsync = async (environmentTreeItem) => {
  try {
    const { environmentName } = environmentTreeItem || {};
    if (!environmentName) {
      return;
    }
    const currentContent = await Configuration.getSessionConfiguration();
    const activeEnvironment = currentContent.activeEnvironment === environmentName ? "" : environmentName;
    await Configuration.writeSessionFile({ ...currentContent, activeEnvironment });
  } catch (error) {
    showErrorMessageWithDetail(constants.setActiveEnvironmentFailed, error);
  }
};
