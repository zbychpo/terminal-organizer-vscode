import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

export var removeTerminalActivityAsync = async (terminalTreeItem) => {
  try {
    const { sessionId, terminalArrayIndex, label } = terminalTreeItem || {};
    if (!sessionId || terminalArrayIndex === undefined) {
      return;
    }
    const configuration = await Configuration.resolve(terminalTreeItem);
    if (!configuration) {
      return;
    }
    const config = await configuration.load();
    if (!config?.sessions) {
      return;
    }
    const { sessions } = config;
    const session = sessions[sessionId];
    const sessionItem = session?.[terminalArrayIndex];
    if (!sessionItem) {
      return;
    }
    if (Array.isArray(sessionItem)) {
      const index = sessionItem.findIndex((t) => t.name === label);
      if (index === -1) {
        return;
      }
      sessionItem.splice(index, 1);
      if (sessionItem.length === 0) {
        session.splice(terminalArrayIndex, 1);
      }
    } else {
      session.splice(terminalArrayIndex, 1);
    }
    await configuration.save({ sessions });
    vscode.window.showInformationMessage(constants.removeTerminalSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.removeTerminalFailed, error);
  }
};
