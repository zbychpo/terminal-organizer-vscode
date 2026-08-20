import * as vscode from 'vscode';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail, killAllTerminal } from '../utils/utils';

export var killAllAsync = async () => {
  try {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: "Terminal Organizer",
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: "Kill all terminals..." });
        if (vscode.window.terminals && vscode.window.terminals.length > 0) {
          await killAllTerminal();
        }
        return "Kill all of the terminal completed!";
      }
    );
  } catch (error) {
    showErrorMessageWithDetail(constants.killTerminalFailed, error);
  }
};
