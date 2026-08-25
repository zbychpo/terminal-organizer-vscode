import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { pickVariableValue } from '../utils/pick-variable-value';
import { showErrorMessageWithDetail } from '../utils/utils';

export var editEnvironmentVariableAsync = async (environmentVariableTreeItem) => {
  try {
    const { environmentName, variableName } = environmentVariableTreeItem || {};
    if (!environmentName || !variableName) {
      return;
    }
    const currentContent = await Configuration.getSessionConfiguration();
    const environments = currentContent.environments || {};
    const environment = environments[environmentName] || {};
    const value = await pickVariableValue(environment[variableName] ?? "", {
      title: constants.pickEnvironmentVariableValueTitle,
      placeholder: constants.pickEnvironmentVariableValuePlaceHolder
    });
    if (value === undefined) {
      return;
    }
    await Configuration.writeSessionFile({
      ...currentContent,
      environments: { ...environments, [environmentName]: { ...environment, [variableName]: value } }
    });
  } catch (error) {
    showErrorMessageWithDetail(constants.editEnvironmentVariableFailed, error);
  }
};
