import * as vscode from 'vscode';
import { Configuration, MultiRootMode } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

// Switches terminal-organizer-vscode.multiRootMode, saved in the workspace
// settings (the .code-workspace file in a multi-root workspace).
export var changeMultiRootModeAsync = async () => {
  try {
    const current = Configuration.getMultiRootMode();
    const items: (vscode.QuickPickItem & { mode: MultiRootMode })[] = [
      { mode: "separate", label: "separate", description: current === "separate" ? "current · default" : "default", detail: constants.multiRootModeSeparateDescription },
      { mode: "inherit", label: "inherit", description: current === "inherit" ? "current" : undefined, detail: constants.multiRootModeInheritDescription.replace(/`/g, "") }
    ];
    const picked = await vscode.window.showQuickPick(items, {
      title: constants.changeMultiRootModeTitle,
      ignoreFocusOut: true,
      matchOnDetail: true
    });
    if (!picked || picked.mode === current) {
      return;
    }
    await vscode.workspace
      .getConfiguration(Configuration.wsConfigurationSpace)
      .update("multiRootMode", picked.mode, vscode.ConfigurationTarget.Workspace);
  } catch (error) {
    showErrorMessageWithDetail(constants.changeMultiRootModeFailed, error);
  }
};
