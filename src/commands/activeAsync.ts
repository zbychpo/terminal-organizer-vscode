import * as terminalBrowserify from '@vscode-utility/terminal-browserify';
import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { updateStatusBar } from '../utils/show-status-bar';
import { showErrorMessageWithDetail, getSessionQuickPickItems, showGenerateConfiguration, killAllTerminal } from '../utils/utils';
import { substituteVariablesDeep } from '../utils/variable-substitution';
import { resolveVscodeVariablesDeep } from '../utils/vscode-variable-resolver';

export var activeAsync = async (workspacePath) => {
  try {
    const isDefinedSessionFile = await Configuration.isDefinedSessionFile();
    if (!isDefinedSessionFile) {
      await showGenerateConfiguration();
      return;
    }
    const config = await Configuration.load();
    const { keepExistingTerminals = false, sessions, theme = "default", noClear = false, active = "", variable } = config;
    if (!sessions) {
      vscode.window.showWarningMessage(constants.notExistAnySessions);
      return;
    }
    const sessionsWithDescription = getSessionQuickPickItems(sessions);
    const size = sessionsWithDescription?.length || 0;
    let selectedSessionKey = active;
    if (size > 1) {
      const quickPickItem = await vscode.window.showQuickPick(sessionsWithDescription, {
        title: constants.selectSessionActiveTitle,
        placeHolder: constants.selectSessionActivePlaceHolder,
        canPickMany: false,
        ignoreFocusOut: true
      });
      if (!quickPickItem) {
        return;
      }
      selectedSessionKey = quickPickItem.label;
    }
    if (!selectedSessionKey) {
      vscode.window.showWarningMessage(constants.selectSessionToActive.replace("{session}", selectedSessionKey));
      return;
    }
    const selectedSession = sessions[selectedSessionKey];
    if (!selectedSession || selectedSession.length <= 0) {
      vscode.window.showWarningMessage(constants.notExistAnySpitTerminal.replace("{session}", selectedSessionKey));
      return;
    }
    const activatedSession = substituteVariablesDeep(
      resolveVscodeVariablesDeep(
        selectedSession.map((sessionItem) => {
          if (Array.isArray(sessionItem)) {
            const filtered = sessionItem.filter((i) => !i.disabled);
            return filtered.length <= 0 ? undefined : filtered;
          } else {
            return sessionItem.disabled ? undefined : sessionItem;
          }
        }).filter(Boolean)
      ),
      resolveVscodeVariablesDeep(variable)
    );
    if (!activatedSession || activatedSession.length <= 0) {
      vscode.window.showWarningMessage(constants.notExistAnySpitTerminalAfterFilter.replace("{session}", selectedSessionKey));
      return;
    }
    const { createTerminal, focusTerminal, getCwdPath } = terminalBrowserify.TerminalApi.instance();
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: "Terminal Organizer",
        cancellable: false
      },
      async (progress) => {
        if (!keepExistingTerminals) {
          progress.report({ message: "Killing previous terminals..." });
          await killAllTerminal();
        }
        progress.report({ message: "Validating the configuration file..." });
        const flatActivatedSession = activatedSession.flat();
        for (let i = 0; i < flatActivatedSession.length; i++) {
          const sessionItem = flatActivatedSession[i];
          progress.report({ message: `Checking that "${sessionItem.cwd}" exists...` });
          const cwdPath = await getCwdPath(sessionItem.cwd);
          if (cwdPath) {
            sessionItem.cwdPath = cwdPath;
          } else {
            sessionItem.cwd = workspacePath;
            sessionItem.cwdPath = workspacePath;
          }
        }
        const themeService = new terminalBrowserify.ThemeService(theme);
        activatedSession.forEach((sessionItem) => {
          if (Array.isArray(sessionItem)) {
            progress.report({
              message: `Initializing the terminal session for "${sessionItem[0].name}"...`
            });
            const parentTerminal = createTerminal(
              themeService,
              sessionItem[0],
              { kind: "parent" },
              noClear
            );
            for (let i = sessionItem.length - 1; i >= 1; i--) {
              progress.report({
                message: `Initializing the terminal session for "${sessionItem[i].name}"...`
              });
              createTerminal(themeService, sessionItem[i], { kind: "children", parentTerminal }, noClear);
            }
          } else {
            progress.report({ message: `Initializing the terminal session for "${sessionItem.name}"...` });
            createTerminal(themeService, sessionItem, { kind: "standalone" }, noClear);
          }
        });
        focusTerminal(flatActivatedSession);
        updateStatusBar(selectedSessionKey);
        progress.report({ message: "Waiting for the terminal session to render completely..." });
        await Configuration.save({ active: selectedSessionKey });
        return "Initialization of the terminal session completed!";
      }
    );
  } catch (error) {
    showErrorMessageWithDetail(constants.activeSessionFailed, error);
  }
};
