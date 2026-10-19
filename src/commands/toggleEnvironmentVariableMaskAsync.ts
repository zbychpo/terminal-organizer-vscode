import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

export var toggleMask = (mask, variableName) => {
  const currentMask = Array.isArray(mask) ? mask : [];
  return currentMask.includes(variableName)
    ? currentMask.filter((name) => name !== variableName)
    : [...currentMask, variableName];
};

export var toggleEnvironmentVariableMaskAsync = async (environmentVariableTreeItem) => {
  try {
    const { environmentName, variableName } = environmentVariableTreeItem || {};
    if (!environmentName || !variableName || variableName === "inherits" || variableName === "mask") {
      return;
    }
    const configuration = await Configuration.resolve(environmentVariableTreeItem);
    if (!configuration) {
      return;
    }
    const currentContent = await configuration.getSessionConfiguration();
    const environments = currentContent.environments || {};
    const environment = environments[environmentName] || {};
    const updatedMask = toggleMask(environment.mask, variableName);
    const updatedEnvironment = { ...environment };
    if (updatedMask.length > 0) {
      updatedEnvironment.mask = updatedMask;
    } else {
      delete updatedEnvironment.mask;
    }
    await configuration.writeSessionFile({
      ...currentContent,
      environments: { ...environments, [environmentName]: updatedEnvironment }
    });
  } catch (error) {
    showErrorMessageWithDetail(constants.toggleEnvironmentVariableMaskFailed, error);
  }
};
