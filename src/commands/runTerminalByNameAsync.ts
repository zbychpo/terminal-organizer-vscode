import * as vscode from 'vscode';
import { activeByTerminalAsync } from './activeByTerminalAsync';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { findTerminalByName } from '../utils/find-terminal-in-config';
import { showErrorMessageWithDetail, showGenerateConfiguration } from '../utils/utils';

var getTerminalQuickPickItems = (sessions) => {
  const items = [];
  for (const [sessionId, sessionItems] of Object.entries(sessions)) {
    if (!sessionItems || !Array.isArray(sessionItems)) {
      continue;
    }
    for (let index = 0; index < sessionItems.length; index++) {
      const item = sessionItems[index];
      const baseItem = { description: `Session: ${sessionId}`, sessionId, index };
      if (Array.isArray(item)) {
        items.push({
          ...baseItem,
          label: `$(split-horizontal) ${item.map((t) => t.name).join(", ")}`,
          detail: "Terminal group (split)",
          terminalName: undefined
        });
      } else if (item.name) {
        const commandsPreview = Array.isArray(item.commands) ? item.commands.join("; ") : "";
        items.push({
          ...baseItem,
          label: `$(terminal) ${item.name}`,
          detail: commandsPreview || "(no commands)",
          terminalName: item.name
        });
      }
    }
  }
  return items;
};
// Scopes to search: the one named by args.project (a workspace folder name,
// or the workspace-level scope's name) when given, otherwise all of them.
var getScopesToSearch = (project) => {
  const scopes = Configuration.all();
  if (!project) {
    return scopes;
  }
  return scopes.filter((s) => s.label === project || s.id === project || (s.kind === "workspace" && project === "workspace"));
};
var findTerminalInScopes = async (scopes: Configuration[], name, session) => {
  const results = [];
  for (const configuration of scopes) {
    const result = await findTerminalByName(configuration, name, session);
    if (result) {
      results.push({ ...result, configuration });
    }
  }
  if (results.length <= 1) {
    return results[0];
  }
  const picked = await vscode.window.showQuickPick(
    results.map((result) => ({ label: result.configuration.label, description: `Session: ${result.sessionId}`, detail: result.configuration.sessionFilePath, result })),
    { title: constants.selectTerminalTitle, placeHolder: constants.selectTerminalPlaceHolder, ignoreFocusOut: true }
  );
  return picked?.result;
};
// args: { name?, session?, project? } - e.g. from a keybinding.
export var runTerminalByNameAsync = async (args) => {
  try {
    let { name, session, project } = args || {};
    if (!name) {
      const scopes = getScopesToSearch(project);
      const configuration = scopes.length === 1 ? scopes[0] : await Configuration.resolve(undefined, { title: constants.selectTerminalTitle });
      if (!configuration) {
        return;
      }
      const isDefinedSessionFile = await configuration.isDefinedSessionFile();
      if (!isDefinedSessionFile) {
        await showGenerateConfiguration(configuration);
        return;
      }
      const config = await configuration.load();
      if (!config?.sessions) {
        vscode.window.showWarningMessage(constants.notExistAnySessions);
        return;
      }
      const sessionsToShow = session ? { [session]: config.sessions[session] } : config.sessions;
      const items = getTerminalQuickPickItems(sessionsToShow);
      if (items.length === 0) {
        vscode.window.showWarningMessage(constants.notExistAnySessions);
        return;
      }
      const selected = await vscode.window.showQuickPick(items, {
        title: constants.selectTerminalTitle,
        placeHolder: constants.selectTerminalPlaceHolder,
        canPickMany: false,
        ignoreFocusOut: true,
        matchOnDescription: true,
        matchOnDetail: true
      });
      if (!selected) {
        return;
      }
      await activeByTerminalAsync(configuration, selected.sessionId, selected.index, selected.terminalName);
      return;
    }
    const result = await findTerminalInScopes(getScopesToSearch(project), name, session);
    if (!result) {
      const message = session ? constants.terminalNotFound.replace("{name}", name).replace("{session}", session) : constants.terminalNotFoundInAny.replace("{name}", name);
      vscode.window.showWarningMessage(message);
      return;
    }
    const terminalName = Array.isArray(result.terminal) ? undefined : name;
    await activeByTerminalAsync(result.configuration, result.sessionId, result.index, terminalName);
  } catch (error) {
    showErrorMessageWithDetail(constants.runTerminalByNameFailed, error);
  }
};
