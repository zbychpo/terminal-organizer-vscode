import * as vscode from 'vscode';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

// Tree views have no per-item overflow menu, so the inline "More Actions"
// (...) button lists the item's right-click (non-inline) menu entries from
// package.json - read at runtime, so it always matches the context menu.
var matchesViewItem = (when: string, contextValue: string) =>
  `${when || ""}`.split("||").some((clause) => {
    const match = clause.trim().match(/^viewItem\s*==\s*(\S+)$/);
    return !!match && match[1] === contextValue;
  });

export var getItemMenuEntries = (packageJSON, contextValue: string) => {
  const titles = Object.fromEntries((packageJSON?.contributes?.commands || []).map((c) => [c.command, c.title]));
  return (packageJSON?.contributes?.menus?.["view/item/context"] || [])
    .filter((entry) => entry.group && !`${entry.group}`.startsWith("inline") && matchesViewItem(entry.when, contextValue))
    .map((entry) => ({ command: entry.command, title: titles[entry.command] || entry.command }));
};

export var showItemMenuActivityAsync = async (packageJSON, treeItem) => {
  try {
    const contextValue = treeItem?.contextValue;
    if (!contextValue) {
      return;
    }
    const entries = getItemMenuEntries(packageJSON, contextValue);
    if (entries.length === 0) {
      return;
    }
    const items: (vscode.QuickPickItem & { command: string })[] = entries.map((entry) => ({ label: entry.title, command: entry.command }));
    const picked = await vscode.window.showQuickPick(items, {
      title: constants.itemMenuTitle.replace("{name}", `${treeItem.label ?? ""}`), placeHolder: constants.itemMenuPlaceHolder
    });
    if (!picked) {
      return;
    }
    await vscode.commands.executeCommand(picked.command, treeItem);
  } catch (error) {
    showErrorMessageWithDetail(constants.itemMenuFailed, error);
  }
};
