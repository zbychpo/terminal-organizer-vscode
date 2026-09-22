import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

const collectAllTerminalNames = (sessions) => {
  const names = new Set<string>();
  Object.values(sessions || {}).forEach((session: any[]) => {
    session.forEach((sessionItem) => {
      if (Array.isArray(sessionItem)) {
        sessionItem.forEach((terminal) => names.add(terminal.name));
      } else {
        names.add(sessionItem.name);
      }
    });
  });
  return names;
};

export var duplicateTerminalActivityAsync = async (terminalTreeItem) => {
  try {
    const { sessionId, terminalArrayIndex, label } = terminalTreeItem || {};
    if (!sessionId || terminalArrayIndex === undefined) {
      return;
    }
    const config = await Configuration.load();
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
    await Configuration.save({ sessions });
    vscode.window.showInformationMessage(constants.duplicateTerminalSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.duplicateTerminalFailed, error);
  }
};
