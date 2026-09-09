import * as fsBrowserify from '@vscode-utility/fs-browserify';
import * as path from 'path';
import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { parseDotEnv } from '../utils/parse-dotenv';
import { showErrorMessageWithDetail, isWorkspaceOpened, showGenerateConfiguration } from '../utils/utils';

export var importVariablesAsync = async () => {
  try {
    if (!isWorkspaceOpened()) {
      vscode.window.showWarningMessage(constants.openWorkspace);
      return;
    }
    const isDefinedSessionFile = await Configuration.isDefinedSessionFile();
    if (!isDefinedSessionFile) {
      await showGenerateConfiguration();
      return;
    }
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { "Env files": ["env"], "All files": ["*"] },
      openLabel: constants.importVariablesDialogLabel
    });
    const fileUri = picked?.[0];
    if (!fileUri) {
      return;
    }
    const content = await fsBrowserify.fs.readFileAsync(fileUri);
    const importedVariables = parseDotEnv(content);
    const importedNames = Object.keys(importedVariables);
    if (importedNames.length === 0) {
      vscode.window.showWarningMessage(constants.importVariablesEmpty);
      return;
    }
    // Writes the raw file directly instead of Configuration.save(), which
    // only ever updates keys that already exist in the file - "variable"
    // wouldn't exist yet on any sessions.json generated before this feature.
    const currentContent = await Configuration.getSessionConfiguration();
    const variable = currentContent.variable || {};
    await Configuration.writeSessionFile({
      ...currentContent,
      variable: { ...variable, ...importedVariables }
    });
    const suggestedEnvironmentName = path.basename(fileUri.fsPath).replace(/^\.+/, "") || "env";
    const environmentName = await vscode.window.showInputBox({
      title: constants.importVariablesEnvironmentNameTitle,
      placeHolder: constants.enterEnvironmentNamePlaceHolder,
      value: suggestedEnvironmentName,
      ignoreFocusOut: true
    });
    if (environmentName) {
      const importedVariableReferences: Record<string, string> = {};
      importedNames.forEach((name) => {
        importedVariableReferences[name] = `\${variable:${name}}`;
      });
      const updatedContent = await Configuration.getSessionConfiguration();
      const environments = updatedContent.environments || {};
      await Configuration.writeSessionFile({
        ...updatedContent,
        environments: { ...environments, [environmentName]: { ...(environments[environmentName] || {}), ...importedVariableReferences } }
      });
      vscode.window.showInformationMessage(
        constants.importVariablesEnvironmentSuccess.replace("{count}", `${importedNames.length}`).replace("{name}", environmentName)
      );
      return;
    }
    vscode.window.showInformationMessage(constants.importVariablesSuccess.replace("{count}", `${importedNames.length}`));
  } catch (error) {
    showErrorMessageWithDetail(constants.importVariablesFailed, error);
  }
};
