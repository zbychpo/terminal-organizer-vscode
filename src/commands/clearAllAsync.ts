import * as vscode from 'vscode';
import { sysCommands, constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

export var clearAllAsync = async () => {
  try {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: "Terminal Organizer",
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: "Clear all terminals..." });
        vscode.window.terminals.forEach(async (terminal) => {
          terminal.show();
          await vscode.commands.executeCommand(sysCommands.terminalClear, terminal);
        });
        return "Clear all of the terminal completed!";
      }
    );
  } catch (error) {
    showErrorMessageWithDetail(constants.clearTerminalFailed, error);
  }
};
