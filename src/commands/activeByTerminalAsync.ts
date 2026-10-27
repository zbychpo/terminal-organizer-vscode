import * as terminalBrowserify from '@vscode-utility/terminal-browserify';
import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { findTerminal } from '../utils/find-terminal-in-config';
import { showErrorMessageWithDetail } from '../utils/utils';
import { substituteVariablesDeep } from '../utils/variable-substitution';
import { resolveVscodeVariablesDeep } from '../utils/vscode-variable-resolver';
import { applyEnvironmentToTerminals, resolveEnvironmentVariables } from '../utils/environment-merge';
import { applyGlobalJoinOperator } from '../utils/join-operator-merge';
import { resolveRelativeCwdDeep } from '../utils/scope-merge';
import { logLaunch } from '../utils/launch-log';

export var activeByTerminalAsync = async (configuration: Configuration, sessionId, terminalArrayIndex, terminalItemName) => {
  try {
    const foundTerminal = await findTerminal(configuration, sessionId, terminalArrayIndex, terminalItemName);
    if (!foundTerminal) {
      vscode.window.showWarningMessage(constants.selectTerminalToActive);
      return;
    }
    const { createTerminal, getCwdPath } = terminalBrowserify.TerminalApi.instance();
    const config = await configuration.loadEffective();
    const { theme = "default", noClear = false, variable, environments = {}, activeEnvironment = "", joinOperator } = config;
    const activeEnvironmentVariables = resolveEnvironmentVariables(environments, activeEnvironment);
    const terminal = resolveRelativeCwdDeep(
      substituteVariablesDeep(
        resolveVscodeVariablesDeep(applyEnvironmentToTerminals(applyGlobalJoinOperator(foundTerminal, joinOperator), activeEnvironmentVariables), configuration.folderPath),
        resolveVscodeVariablesDeep(variable, configuration.folderPath)
      ),
      configuration.folderPath,
      configuration.ownsDefaultCwd
    );
    const themeService = new terminalBrowserify.ThemeService(theme);
    const terminals = Array.isArray(terminal) ? terminal : [terminal];
    for (let i = 0; i < terminals.length; i++) {
      const tm = terminals[i];
      // Notes for the Activity Bar only - not a terminal option.
      delete tm.description;
      const cwdPath = await getCwdPath(tm.cwd);
      if (cwdPath) {
        tm.cwdPath = cwdPath;
      }
    }
    await logLaunch({
      configuration,
      title: Array.isArray(foundTerminal) ? `split-terminal group (session "${sessionId}")` : `terminal "${foundTerminal.name}" (session "${sessionId}")`,
      effectiveConfig: config,
      rawTerminals: Array.isArray(foundTerminal) ? foundTerminal : [foundTerminal],
      resolvedTerminals: terminals
    });
    if (Array.isArray(terminal)) {
      const terminals2 = terminal.filter((t) => !t.disabled);
      if (terminals2.length <= 0) {
        vscode.window.showWarningMessage(constants.groupTerminalWillBeDisabled);
        return;
      }
      const parentTerminal = createTerminal(themeService, terminals2[0], { kind: "parent" }, noClear);
      for (let i = terminals2.length - 1; i >= 1; i--) {
        createTerminal(themeService, terminals2[i], { kind: "children", parentTerminal }, noClear);
      }
    } else {
      if (terminal.disabled) {
        vscode.window.showWarningMessage(constants.terminalWillBeDisabled);
        return;
      }
      createTerminal(themeService, terminal, { kind: "standalone" }, noClear);
    }
  } catch (error) {
    showErrorMessageWithDetail(constants.activeTerminalFailed, error);
  }
};
