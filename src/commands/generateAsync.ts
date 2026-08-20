import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { configurationTemplate } from '../configuration/template';
import { sysCommands, constants } from '../utils/constants';
import { showErrorMessageWithDetail, showTextDocument, isWorkspaceOpened } from '../utils/utils';

export var generateAsync = async () => {
  try {
    if (!isWorkspaceOpened()) {
      vscode.window.showInformationMessage(
        constants.openWorkspace,
        constants.openFolderButton,
        constants.openWorkspaceButton
      ).then(async (selection) => {
        if (selection === constants.openFolderButton) {
          await vscode.commands.executeCommand(sysCommands.openFolder);
        }
        if (selection === constants.openWorkspaceButton) {
          await vscode.commands.executeCommand(sysCommands.openWorkspace);
        }
      });
      return;
    }
    const isDefinedSessionFile = await Configuration.isDefinedSessionFile();
    if (isDefinedSessionFile) {
      vscode.window.showWarningMessage(constants.configurationFileAlreadyExist);
      return;
    }
    await Configuration.save(configurationTemplate);
    vscode.window.showInformationMessage(constants.generateConfigurationSuccess, constants.viewConfigurationButton).then((selection) => {
      if (selection === constants.viewConfigurationButton) {
        showTextDocument(Configuration.sessionFilePath);
      }
    });
    showTextDocument(Configuration.sessionFilePath);
  } catch (error) {
    showErrorMessageWithDetail(constants.generateConfigurationFailed, error);
  }
};
