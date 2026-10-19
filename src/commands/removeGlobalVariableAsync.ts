import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

export var removeGlobalVariableAsync = async (variableTreeItem) => {
  try {
    const { variableName } = variableTreeItem || {};
    if (!variableName) {
      return;
    }
    const variables = { ...Configuration.getGlobalVariables() };
    delete variables[variableName];
    await Configuration.setGlobalVariables(variables);
    vscode.window.showInformationMessage(constants.removeGlobalVariableSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.removeGlobalVariableFailed, error);
  }
};
