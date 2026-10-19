import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { pickVariableValue } from '../utils/pick-variable-value';
import { showErrorMessageWithDetail } from '../utils/utils';

export var editVariableAsync = async (variableTreeItem) => {
  try {
    const { variableName } = variableTreeItem || {};
    if (!variableName) {
      return;
    }
    const configuration = await Configuration.resolve(variableTreeItem);
    if (!configuration) {
      return;
    }
    const currentContent = await configuration.getSessionConfiguration();
    const variable = currentContent.variable || {};
    const value = await pickVariableValue(variable[variableName] ?? "");
    if (value === undefined) {
      return;
    }
    await configuration.writeSessionFile({
      ...currentContent,
      variable: { ...variable, [variableName]: value }
    });
  } catch (error) {
    showErrorMessageWithDetail(constants.editVariableFailed, error);
  }
};
