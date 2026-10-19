import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

export var removeVariableAsync = async (variableTreeItem) => {
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
    const variable = { ...(currentContent.variable || {}) };
    delete variable[variableName];
    await configuration.writeSessionFile({ ...currentContent, variable });
    vscode.window.showInformationMessage(constants.removeVariableSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.removeVariableFailed, error);
  }
};
