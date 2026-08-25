import * as vscode from 'vscode';
import { constants } from './constants';

export var pickVariableValue = (initialValue, options: { title?: string; placeholder?: string } = {}) => {
  return new Promise((resolve) => {
    const input = vscode.window.createInputBox();
    input.title = options.title || constants.pickVariableValueTitle;
    input.placeholder = options.placeholder || constants.pickVariableValuePlaceHolder;
    input.value = initialValue || "";
    input.ignoreFocusOut = true;
    input.buttons = [
      {
        iconPath: new vscode.ThemeIcon("folder-opened"),
        tooltip: constants.pickVariableValueButtonTooltip
      }
    ];
    let accepted = false;
    input.onDidTriggerButton(async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: constants.pickVariableValueDialogLabel
      });
      if (picked?.[0]) {
        input.value = picked[0].fsPath;
      }
    });
    input.onDidAccept(() => {
      accepted = true;
      resolve(input.value);
      input.hide();
    });
    input.onDidHide(() => {
      if (!accepted) {
        resolve(undefined);
      }
      input.dispose();
    });
    input.show();
  });
};
