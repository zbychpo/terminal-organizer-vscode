import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { hasCircularInheritance } from '../utils/environment-merge';
import { showErrorMessageWithDetail } from '../utils/utils';

export var editEnvironmentInheritanceAsync = async (environmentTreeItem) => {
  try {
    const { environmentName } = environmentTreeItem || {};
    if (!environmentName) {
      return;
    }
    const currentContent = await Configuration.getSessionConfiguration();
    const environments = currentContent.environments || {};
    if (!Object.prototype.hasOwnProperty.call(environments, environmentName)) {
      return;
    }
    const environment = environments[environmentName] || {};
    const currentInherits = Array.isArray(environment.inherits) ? environment.inherits : [];
    const otherEnvironmentNames = Object.keys(environments).filter((name) => name !== environmentName);
    if (otherEnvironmentNames.length === 0) {
      vscode.window.showInformationMessage(constants.environmentInheritanceNoOtherEnvironments);
      return;
    }
    // Already-inherited environments keep their existing precedence order (top to bottom); the rest follow after them.
    const orderedNames = [
      ...currentInherits.filter((name) => otherEnvironmentNames.includes(name)),
      ...otherEnvironmentNames.filter((name) => !currentInherits.includes(name))
    ];
    const items: (vscode.QuickPickItem & { picked?: boolean })[] = orderedNames.map((name) => ({
      label: name,
      picked: currentInherits.includes(name)
    }));
    const picked = await vscode.window.showQuickPick(items, {
      title: constants.editEnvironmentInheritanceTitle.replace("{name}", environmentName),
      placeHolder: constants.editEnvironmentInheritancePlaceHolder,
      canPickMany: true,
      ignoreFocusOut: true
    });
    if (picked === undefined) {
      return;
    }
    const pickedNames = new Set(picked.map((item) => item.label));
    const names = orderedNames.filter((name) => pickedNames.has(name));
    const candidateEnvironments = { ...environments, [environmentName]: { ...environment, inherits: names } };
    if (hasCircularInheritance(candidateEnvironments, environmentName)) {
      vscode.window.showErrorMessage(constants.environmentInheritanceCircular);
      return;
    }
    const { inherits: _oldInherits, ...ownVariables } = environment;
    const updatedEnvironment = names.length > 0 ? { inherits: names, ...ownVariables } : ownVariables;
    await Configuration.writeSessionFile({
      ...currentContent,
      environments: { ...environments, [environmentName]: updatedEnvironment }
    });
    vscode.window.showInformationMessage(constants.editEnvironmentInheritanceSuccess);
  } catch (error) {
    showErrorMessageWithDetail(constants.editEnvironmentInheritanceFailed, error);
  }
};
