import * as path from 'path';
import * as vscode from 'vscode';
import { constants } from './constants';

// Where the folder picker starts: the current value when it's an absolute
// path (no placeholders), else the first workspace folder. Built on the
// workspace folder's Uri, so on a remote (SSH, WSL, container) it opens on
// the remote file system.
var getDefaultUri = (value: string) => {
  const base = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (value && !value.includes("${") && (path.isAbsolute(value) || path.posix.isAbsolute(value))) {
    if (base && base.scheme !== "file") {
      return base.with({ path: value.replace(/\\/g, "/") });
    }
    return vscode.Uri.file(value);
  }
  return base;
};

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
    // On a remote window (and with files.simpleDialog.enable) the open dialog
    // is itself a quick input, which hides this one - that must not count as
    // cancelling. The input box is shown again once the dialog closes.
    let picking = false;
    input.onDidTriggerButton(async () => {
      const value = input.value;
      picking = true;
      let picked: vscode.Uri[] | undefined;
      try {
        picked = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: true,
          canSelectMany: false,
          defaultUri: getDefaultUri(value),
          openLabel: constants.pickVariableValueDialogLabel
        });
      } finally {
        picking = false;
      }
      input.value = picked?.[0] ? picked[0].fsPath : value;
      input.show();
    });
    input.onDidAccept(() => {
      accepted = true;
      resolve(input.value);
      input.hide();
    });
    input.onDidHide(() => {
      if (picking) {
        return;
      }
      if (!accepted) {
        resolve(undefined);
      }
      input.dispose();
    });
    input.show();
  });
};
