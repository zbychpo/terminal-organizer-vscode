import * as terminalBrowserify from '@vscode-utility/terminal-browserify';
import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { extCommands, sysCommands, constants } from './constants';

export var showErrorMessageWithDetail = (message, error) => {
  const detailError = error instanceof Error ? error?.message : `${error}`;
  vscode.window.showErrorMessage(message, constants.viewError).then((selection) => {
    if (selection === constants.viewError) {
      vscode.window.showErrorMessage(detailError, { modal: true });
    }
  });
};
export var showTextDocument = (filePath) => {
  const existingDoc = vscode.workspace.textDocuments.find((doc) => doc.uri.fsPath === filePath);
  if (existingDoc) {
    const visibleEditor = vscode.window.visibleTextEditors.find((editor) => editor.document === existingDoc);
    if (visibleEditor) {
      vscode.window.showTextDocument(visibleEditor.document, visibleEditor.viewColumn, false);
    } else {
      vscode.window.showTextDocument(existingDoc, { preserveFocus: false });
    }
  } else {
    const stepDefinitionFileUri = vscode.Uri.file(filePath);
    vscode.window.showTextDocument(stepDefinitionFileUri, { preserveFocus: false });
  }
};
var showQuickPick = async (params) => {
  const { title, placeHolder, items, additionItems = [] } = params;
  const quickPickItems: vscode.QuickPickItem[] = [...items.map((key) => ({ label: key })), ...additionItems];
  const selected = await vscode.window.showQuickPick(quickPickItems, {
    title,
    placeHolder,
    canPickMany: false,
    ignoreFocusOut: true
  });
  return selected;
};
export var getSessionQuickPickItems = (sessions: Record<string, any[]>): vscode.QuickPickItem[] => {
  if (!sessions) {
    return [];
  }
  const sessionsWithDescription = Object.entries(sessions).map(([label, session]) => {
    const descriptions = [];
    session.forEach((sessionItem) => {
      if (Array.isArray(sessionItem)) {
        for (let j = 0; j < sessionItem.length; j++) {
          descriptions.push(sessionItem[j].name || "");
        }
      } else {
        descriptions.push(sessionItem.name || "");
      }
    });
    const icon = "arrow-small-right";
    const terminals = descriptions.filter(Boolean).join(", ");
    return { label, detail: `$(${icon})${terminals}` };
  });
  return sessionsWithDescription;
};
export var getTabWidth = () => {
  let prettierTabWidth = vscode.workspace.getConfiguration().get("prettier.tabWidth");
  if (!Number.isNaN(prettierTabWidth) && Number(prettierTabWidth) > 0) {
    return Number(prettierTabWidth);
  }
  const editorTabWidth = vscode.workspace.getConfiguration().get("editor.tabSize");
  if (!Number.isNaN(editorTabWidth) && Number(editorTabWidth) > 0) {
    return Number(editorTabWidth);
  }
  const defaultTabWidth = 4;
  return defaultTabWidth;
};
export var showGenerateConfiguration = async () => {
  const quickPickItem = await showQuickPick({
    title: constants.generateConfigurationTitle,
    placeHolder: constants.generateConfigurationPlaceHolder,
    items: [constants.yesButton, constants.noButton]
  });
  if (quickPickItem && quickPickItem.label === constants.yesButton) {
    await vscode.commands.executeCommand(extCommands.generate);
  }
};
export var isWorkspaceOpened = () => {
  return vscode.workspace.name !== undefined;
};
export var killAllTerminal = async () => {
  try {
    await vscode.commands.executeCommand(sysCommands.terminalTabFocus);
    const isKillProcess = Configuration.getExperimentalConfig("killProcess");
    await terminalBrowserify.TerminalApi.instance().killAllTerminalAsync(isKillProcess);
  } catch (error) {
  }
};
