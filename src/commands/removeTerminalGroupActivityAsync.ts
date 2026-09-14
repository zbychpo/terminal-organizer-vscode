import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

export var removeTerminalGroupActivityAsync = async (terminalArrayTreeItem) => {
  try {
    const { sessionId, terminalArrayIndex } = terminalArrayTreeItem || {};
    if (!sessionId || terminalArrayIndex === undefined) {
      return;
    }
    const config = await Configuration.load();
    if (!config?.sessions) {
      return;
    }
    const { sessions } = config;
    const session = sessions[sessionId];
    if (!session?.[terminalArrayIndex]) {
      return;
    }
    session.splice(terminalArrayIndex, 1);
    await Configuration.save({ sessions });
    vscode.window.showInformationMessage(constants.removeTerminalGroupSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.removeTerminalGroupFailed, error);
  }
};
