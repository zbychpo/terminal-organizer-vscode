import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { configurationTemplate } from '../configuration/template';
import { sysCommands, constants } from '../utils/constants';
import { showErrorMessageWithDetail, showTextDocument, isWorkspaceOpened } from '../utils/utils';

export var generateAsync = async (target?) => {
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
    const configuration = await Configuration.resolveForGenerate(target);
    if (!configuration) {
      return;
    }
    const isDefinedSessionFile = await configuration.isDefinedSessionFile();
    if (isDefinedSessionFile) {
      vscode.window.showWarningMessage(constants.configurationFileAlreadyExist);
      return;
    }
    await configuration.save(configurationTemplate);
    // A new file can change which scopes exist (e.g. a workspace-level one),
    // and the watcher only rediscovers asynchronously.
    await Configuration.discover();
    vscode.window.showInformationMessage(constants.generateConfigurationSuccess, constants.viewConfigurationButton).then((selection) => {
      if (selection === constants.viewConfigurationButton) {
        showTextDocument(configuration.sessionFilePath);
      }
    });
    showTextDocument(configuration.sessionFilePath);
  } catch (error) {
    showErrorMessageWithDetail(constants.generateConfigurationFailed, error);
  }
};
