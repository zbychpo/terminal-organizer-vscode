import * as vscode from 'vscode';
import { activeBySessionAsync } from './activeBySessionAsync';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail, getSessionQuickPickItems, showGenerateConfiguration } from '../utils/utils';

export var activeMultipleSessionsAsync = async (target?) => {
  try {
    const configuration = await Configuration.resolve(target);
    if (!configuration) {
      return;
    }
    const isDefinedSessionFile = await configuration.isDefinedSessionFile();
    if (!isDefinedSessionFile) {
      await showGenerateConfiguration(configuration);
      return;
    }
    const config = await configuration.load();
    if (!config?.sessions) {
      vscode.window.showWarningMessage(constants.notExistAnySessions);
      return;
    }
    const picked = await vscode.window.showQuickPick(getSessionQuickPickItems(config.sessions), {
      title: constants.selectMultipleSessionsActiveTitle,
      placeHolder: constants.selectMultipleSessionsActivePlaceHolder,
      canPickMany: true,
      ignoreFocusOut: true
    });
    if (!picked || picked.length <= 0) {
      return;
    }
    for (let i = 0; i < picked.length; i++) {
      await activeBySessionAsync(configuration, picked[i].label, false, i > 0);
    }
  } catch (error) {
    showErrorMessageWithDetail(constants.activeSessionFailed, error);
  }
};
