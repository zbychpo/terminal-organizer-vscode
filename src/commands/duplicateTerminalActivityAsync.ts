import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { collectAllTerminalNames, showErrorMessageWithDetail } from '../utils/utils';

export var duplicateTerminalActivityAsync = async (terminalTreeItem) => {
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
    const isGroup = Array.isArray(sessionItem);
    const terminalIndexInGroup = isGroup ? sessionItem.findIndex((t) => t.name === label) : -1;
    const originalTerminal = isGroup ? sessionItem[terminalIndexInGroup] : sessionItem;
    if (!originalTerminal) {
      return;
    }
    const allTerminalNames = collectAllTerminalNames(sessions);
    let suggestedName = `${originalTerminal.name} (copy)`;
    let counter = 2;
    while (allTerminalNames.has(suggestedName)) {
      suggestedName = `${originalTerminal.name} (copy ${counter})`;
      counter++;
    }
    const name = await vscode.window.showInputBox({
      title: constants.enterDuplicateTerminalNameTitle,
      placeHolder: constants.enterTerminalNamePlaceHolder,
      value: suggestedName,
      valueSelection: [0, suggestedName.length],
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
    const duplicatedTerminal = { ...JSON.parse(JSON.stringify(originalTerminal)), name };
    if (isGroup) {
      sessionItem.splice(terminalIndexInGroup + 1, 0, duplicatedTerminal);
    } else {
      session.splice(terminalArrayIndex + 1, 0, duplicatedTerminal);
    }
    await configuration.save({ sessions });
    vscode.window.showInformationMessage(constants.duplicateTerminalSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.duplicateTerminalFailed, error);
  }
};
