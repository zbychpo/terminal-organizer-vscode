import * as vscode from 'vscode';
import { extCommands } from './constants';

var statusItem;
var showStatusBar = (activeSession) => {
  if (!statusItem) {
    statusItem = vscode.window.createStatusBarItem(
      "terminal-organizer-vscode.status-bar",
      vscode.StatusBarAlignment.Right,
      Number.MAX_VALUE
    );
    statusItem.name = "Terminal Organizer";
  }
  statusItem.text = `$(terminal) ${activeSession}`;
  statusItem.tooltip = `Current terminal session: ${activeSession}`;
  statusItem.command = {
    title: "Active Terminal Session",
    command: extCommands.active
  };
  statusItem.show();
  return statusItem;
};
// In a multi-root workspace the session name is prefixed with the project
// (scope) it belongs to, e.g. "backend › default".
export var updateStatusBar = (activeSession, scopeLabel?: string) => {
  if (scopeLabel) {
    activeSession = `${scopeLabel} › ${activeSession}`;
  }
  if (!statusItem) {
    statusItem = showStatusBar(activeSession);
    return;
  }
  statusItem.text = `$(terminal) ${activeSession}`;
  statusItem.tooltip = `Current terminal session: ${activeSession}`;
};
