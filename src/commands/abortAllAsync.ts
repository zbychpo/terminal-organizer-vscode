import * as vscode from 'vscode';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

export var abortAllAsync = async () => {
  try {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: "Terminal Organizer",
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: "Abort all terminals..." });
        vscode.window.terminals.forEach(async (terminal) => {
          terminal.sendText(``, true);
        });
        return "Abort all of the terminal completed!";
      }
    );
  } catch (error) {
    showErrorMessageWithDetail(constants.abortTerminalFailed, error);
  }
};
