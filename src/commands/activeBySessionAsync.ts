import * as terminalBrowserify from '@vscode-utility/terminal-browserify';
import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { updateStatusBar } from '../utils/show-status-bar';
import { showErrorMessageWithDetail, showGenerateConfiguration, killAllTerminal } from '../utils/utils';
import { substituteVariablesDeep } from '../utils/variable-substitution';
import { resolveVscodeVariablesDeep } from '../utils/vscode-variable-resolver';
import { applyEnvironmentToTerminals } from '../utils/environment-merge';

export var activeBySessionAsync = async (activeSession, isSaveActiveSession = false) => {
  try {
    const isDefinedSessionFile = await Configuration.isDefinedSessionFile();
    if (!isDefinedSessionFile) {
      await showGenerateConfiguration();
      return;
    }
    const config = await Configuration.load();
    const { keepExistingTerminals = false, sessions, theme = "default", noClear = false, variable, environments = {}, activeEnvironment = "" } = config;
    if (!sessions) {
      vscode.window.showWarningMessage(constants.notExistAnySessions);
      return;
    }
    if (!activeSession) {
      vscode.window.showWarningMessage(constants.selectSessionToActive.replace("{session}", `${activeSession}`));
      return;
    }
    const selectedSession = sessions[activeSession];
    if (!selectedSession || selectedSession.length <= 0) {
      vscode.window.showWarningMessage(constants.notExistAnySpitTerminal.replace("{session}", activeSession));
      return;
    }
    const activeEnvironmentVariables = environments[activeEnvironment] || {};
    const activatedSession = substituteVariablesDeep(
      resolveVscodeVariablesDeep(
        applyEnvironmentToTerminals(
          selectedSession.map((sessionItem) => {
            if (Array.isArray(sessionItem)) {
              const filtered = sessionItem.filter((i) => !i.disabled);
              return filtered.length <= 0 ? undefined : filtered;
            } else {
              return sessionItem.disabled ? undefined : sessionItem;
            }
          }).filter(Boolean),
          activeEnvironmentVariables
        )
      ),
      resolveVscodeVariablesDeep(variable)
    );
    if (!activatedSession || activatedSession.length <= 0) {
      vscode.window.showWarningMessage(constants.notExistAnySpitTerminalAfterFilter.replace("{session}", activeSession));
      return;
    }
    const { createTerminal, focusTerminal, getCwdPath } = terminalBrowserify.TerminalApi.instance();
    await vscode.window.withProgress(
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
        updateStatusBar(activeSession);
        progress.report({ message: "Waiting for the terminal session to render completely..." });
        if (isSaveActiveSession) {
          await Configuration.save({ active: activeSession });
        }
        return "Initialization of the terminal session completed!";
      }
    );
  } catch (error) {
    showErrorMessageWithDetail(constants.activeSessionFailed, error);
  }
};
