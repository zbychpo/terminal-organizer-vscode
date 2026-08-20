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
export var runTerminalByNameAsync = async (args) => {
  try {
    let { name, session } = args || {};
    if (!name) {
      const isDefinedSessionFile = await Configuration.isDefinedSessionFile();
      if (!isDefinedSessionFile) {
        await showGenerateConfiguration();
        return;
      }
      const config = await Configuration.load();
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
      await activeByTerminalAsync(selected.sessionId, selected.index, selected.terminalName);
      return;
    }
    const result = await findTerminalByName(name, session);
    if (!result) {
      const message = session ? constants.terminalNotFound.replace("{name}", name).replace("{session}", session) : constants.terminalNotFoundInAny.replace("{name}", name);
      vscode.window.showWarningMessage(message);
      return;
    }
    const terminalName = Array.isArray(result.terminal) ? undefined : name;
    await activeByTerminalAsync(result.sessionId, result.index, terminalName);
  } catch (error) {
    showErrorMessageWithDetail(constants.runTerminalByNameFailed, error);
  }
};
