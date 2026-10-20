import * as terminalBrowserify from '@vscode-utility/terminal-browserify';
import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { updateStatusBar } from '../utils/show-status-bar';
import { showErrorMessageWithDetail, showGenerateConfiguration, killAllTerminal } from '../utils/utils';
import { substituteVariablesDeep } from '../utils/variable-substitution';
import { resolveVscodeVariablesDeep } from '../utils/vscode-variable-resolver';
import { applyEnvironmentToTerminals, resolveEnvironmentVariables } from '../utils/environment-merge';
import { applyGlobalJoinOperator } from '../utils/join-operator-merge';
import { resolveRelativeCwdDeep } from '../utils/scope-merge';
import { logLaunch } from '../utils/launch-log';

export var activeBySessionAsync = async (configuration: Configuration, activeSession, isSaveActiveSession = false, forceKeepExistingTerminals = false) => {
  try {
    if (!configuration) {
      return;
    }
    const isDefinedSessionFile = await configuration.isDefinedSessionFile();
    if (!isDefinedSessionFile) {
      await showGenerateConfiguration(configuration);
      return;
    }
    const config = await configuration.loadEffective();
    const { keepExistingTerminals = false, sessions, theme = "default", noClear = false, variable, environments = {}, activeEnvironment = "", joinOperator } = config;
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
    const activeEnvironmentVariables = resolveEnvironmentVariables(environments, activeEnvironment);
    const enabledItems = selectedSession.map((sessionItem) => {
      if (Array.isArray(sessionItem)) {
        const filtered = sessionItem.filter((i) => !i.disabled);
        return filtered.length <= 0 ? undefined : filtered;
      } else {
        return sessionItem.disabled ? undefined : sessionItem;
      }
    }).filter(Boolean);
    const activatedSession = resolveRelativeCwdDeep(substituteVariablesDeep(
      resolveVscodeVariablesDeep(
        applyEnvironmentToTerminals(
          applyGlobalJoinOperator(
            enabledItems,
            joinOperator
          ),
          activeEnvironmentVariables
        ),
        configuration.folderPath
      ),
      resolveVscodeVariablesDeep(variable, configuration.folderPath)
    ), configuration.folderPath, configuration.ownsDefaultCwd);
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
        if (!keepExistingTerminals && !forceKeepExistingTerminals) {
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
        await logLaunch({
          configuration,
          title: `session "${activeSession}"`,
          effectiveConfig: config,
          rawTerminals: enabledItems.flat(),
          resolvedTerminals: flatActivatedSession
        });
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
        updateStatusBar(activeSession, configuration.isMultiScope ? configuration.label : undefined);
        progress.report({ message: "Waiting for the terminal session to render completely..." });
        if (isSaveActiveSession) {
          await configuration.save({ active: activeSession });
        }
        return "Initialization of the terminal session completed!";
      }
    );
  } catch (error) {
    showErrorMessageWithDetail(constants.activeSessionFailed, error);
  }
};
