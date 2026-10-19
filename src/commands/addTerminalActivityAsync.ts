import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { collectAllTerminalNames, showErrorMessageWithDetail } from '../utils/utils';

export var addTerminalActivityAsync = async (treeItem) => {
  try {
    const { sessionId, terminalArrayIndex } = treeItem || {};
    if (!sessionId) {
      return;
    }
    const configuration = await Configuration.resolve(treeItem);
    if (!configuration) {
      return;
    }
    const config = await configuration.load();
    if (!config?.sessions) {
      return;
    }
    const { sessions } = config;
    const session = sessions[sessionId];
    if (!session) {
      return;
    }
    const isGroup = terminalArrayIndex !== undefined;
    const group = isGroup ? session[terminalArrayIndex] : undefined;
    if (isGroup && !Array.isArray(group)) {
      return;
    }
    const allTerminalNames = collectAllTerminalNames(sessions);
    const name = await vscode.window.showInputBox({
      title: constants.enterTerminalNameTitle,
      placeHolder: constants.enterTerminalNamePlaceHolder,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return constants.terminalNameNotEmpty;
        }
        if (allTerminalNames.has(value)) {
          return constants.terminalNameIsDuplicated;
        }
        return "";
      }
    });
    if (!name) {
      return;
    }
    const newTerminal = { name, commands: [""] };
    if (isGroup) {
      group.push(newTerminal);
    } else {
      session.push(newTerminal);
    }
    await configuration.save({ sessions });
    vscode.window.showInformationMessage(constants.addTerminalSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.addTerminalFailed, error);
  }
};
