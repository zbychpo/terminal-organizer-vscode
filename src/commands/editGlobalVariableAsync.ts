import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { pickVariableValue } from '../utils/pick-variable-value';
import { showErrorMessageWithDetail } from '../utils/utils';

export var editGlobalVariableAsync = async (variableTreeItem) => {
  try {
    const { variableName } = variableTreeItem || {};
    if (!variableName) {
      return;
    }
    const variables = Configuration.getGlobalVariables();
    const value = await pickVariableValue(variables[variableName] ?? "");
    if (value === undefined) {
      return;
    }
    await Configuration.setGlobalVariables({ ...variables, [variableName]: value as string });
  } catch (error) {
    showErrorMessageWithDetail(constants.editGlobalVariableFailed, error);
  }
};
