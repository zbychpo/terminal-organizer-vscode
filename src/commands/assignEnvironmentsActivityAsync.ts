import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

// Multi-select of the environments available to this scope (its own plus,
// with multiRootMode "inherit", the workspace-level ones). Already-assigned
// environments keep their order (later wins) and come first. Returns
// undefined when cancelled.
export var pickEnvironmentNames = async (configuration: Configuration, current: string[], title: string) => {
  const { environments = {} } = await configuration.loadEffective();
  const available = Object.keys(environments);
  if (available.length === 0) {
    vscode.window.showInformationMessage(constants.assignEnvironmentsNoEnvironments);
    return undefined;
  }
  const orderedNames = [...current.filter((name) => available.includes(name)), ...available.filter((name) => !current.includes(name))];
  const picked = await vscode.window.showQuickPick(
    orderedNames.map((name) => ({ label: name, picked: current.includes(name) })),
    {
      title,
      placeHolder: constants.assignEnvironmentsPlaceHolder,
      canPickMany: true,
      ignoreFocusOut: true
    }
  );
  if (picked === undefined) {
    return undefined;
  }
  const pickedNames = new Set(picked.map((item) => item.label));
  return orderedNames.filter((name) => pickedNames.has(name));
};

export var assignSessionEnvironmentsActivityAsync = async (sessionTreeItem) => {
  try {
    const { sessionId } = sessionTreeItem || {};
    if (!sessionId) {
      return;
    }
    const configuration = await Configuration.resolve(sessionTreeItem);
    if (!configuration) {
      return;
    }
    const currentContent = await configuration.getSessionConfiguration();
    const sessionEnvironments = { ...(currentContent.sessionEnvironments || {}) };
    const current = Array.isArray(sessionEnvironments[sessionId]) ? sessionEnvironments[sessionId] : [];
    const names = await pickEnvironmentNames(configuration, current, constants.assignSessionEnvironmentsTitle.replace("{name}", sessionId));
    if (names === undefined) {
      return;
    }
    if (names.length > 0) {
      sessionEnvironments[sessionId] = names;
    } else {
      delete sessionEnvironments[sessionId];
    }
    // Written directly: save() can't add "sessionEnvironments" to a file that
    // doesn't have it yet.
    const { sessionEnvironments: _old, ...rest } = currentContent;
    await configuration.writeSessionFile(Object.keys(sessionEnvironments).length > 0 ? { ...rest, sessionEnvironments } : rest);
    vscode.window.showInformationMessage(constants.assignEnvironmentsSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.assignEnvironmentsFailed, error);
  }
};

export var assignTerminalEnvironmentsActivityAsync = async (terminalTreeItem) => {
  try {
    const { sessionId, terminalArrayIndex, label } = terminalTreeItem || {};
    if (!sessionId || terminalArrayIndex === undefined) {
      return;
    }
    const configuration = await Configuration.resolve(terminalTreeItem);
    if (!configuration) {
      return;
    }
    const currentContent = await configuration.getSessionConfiguration();
    const sessionItem = currentContent.sessions?.[sessionId]?.[terminalArrayIndex];
    if (!sessionItem) {
      return;
    }
    const terminal = Array.isArray(sessionItem) ? sessionItem.find((t) => t.name === label) : sessionItem;
    if (!terminal) {
      return;
    }
    const current = Array.isArray(terminal.environments) ? terminal.environments : [];
    const names = await pickEnvironmentNames(configuration, current, constants.assignTerminalEnvironmentsTitle.replace("{name}", terminal.name));
    if (names === undefined) {
      return;
    }
    if (names.length > 0) {
      terminal.environments = names;
    } else {
      delete terminal.environments;
    }
    await configuration.writeSessionFile(currentContent);
    vscode.window.showInformationMessage(constants.assignEnvironmentsSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.assignEnvironmentsFailed, error);
  }
};
