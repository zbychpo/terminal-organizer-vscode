import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail, getSessionQuickPickItems } from '../utils/utils';

const themeOptions = ["default", "inkwell", "chaos", "tribe", "iconic", "neon", "solarized", "dice"];
const booleanConfigKeys = ["activateOnStartup", "keepExistingTerminals", "noClear", "killProcess", "wslSupport", "quickRun", "hideCommandsInExplorerDescriptions"];

const getOpenNodeOnStartItems = (config, currentValue) => {
  const { sessions = {}, environments = {} } = config;
  const items: (vscode.QuickPickItem & { picked?: boolean })[] = [
    { label: "Global Configs", description: "group" },
    { label: "Variables", description: "group" },
    { label: "Environments", description: "group" }
  ];
  Object.entries(sessions).forEach(([sessionName, session]: [string, any[]]) => {
    items.push({ label: sessionName, description: "session" });
    session.forEach((terminalOrTerminalArray) => {
      if (Array.isArray(terminalOrTerminalArray)) {
        terminalOrTerminalArray.forEach((terminal) => {
          if (!items.some((item) => item.label === terminal.name)) {
            items.push({ label: terminal.name, description: `split-terminal group in "${sessionName}"` });
          }
        });
      }
    });
  });
  Object.keys(environments).forEach((environmentName) => {
    items.push({ label: environmentName, description: "environment" });
  });
  (Array.isArray(currentValue) ? currentValue : []).forEach((name) => {
    if (!items.some((item) => item.label === name)) {
      items.push({ label: name, description: "custom" });
    }
  });
  items.forEach((item) => {
    item.picked = Array.isArray(currentValue) && currentValue.includes(item.label);
  });
  return items;
};

export var editConfigAsync = async (configTreeItem) => {
  try {
    const { label } = configTreeItem || {};
    if (!label) {
      return;
    }
    const config = await Configuration.load();
    const currentValue = config[label] ?? Configuration.getExperimentalConfig(label);
    const title = constants.editConfigTitle.replace("{key}", label);
    let newValue;
    if (booleanConfigKeys.includes(label)) {
      const picked = await vscode.window.showQuickPick(
        [
          { label: constants.yesButton, value: true },
          { label: constants.noButton, value: false }
        ],
        { title, placeHolder: constants.editConfigBooleanPlaceHolder, ignoreFocusOut: true }
      );
      if (!picked) {
        return;
      }
      newValue = picked.value;
    } else if (label === "theme") {
      const picked = await vscode.window.showQuickPick(themeOptions, {
        title,
        placeHolder: constants.editConfigThemePlaceHolder,
        ignoreFocusOut: true
      });
      if (!picked) {
        return;
      }
      newValue = picked;
    } else if (label === "active") {
      const picked = await vscode.window.showQuickPick(getSessionQuickPickItems(config.sessions), {
        title,
        placeHolder: constants.editConfigActivePlaceHolder,
        ignoreFocusOut: true
      });
      if (!picked) {
        return;
      }
      newValue = picked.label;
    } else if (label === "openNodeOnStart") {
      const picked = await vscode.window.showQuickPick(getOpenNodeOnStartItems(config, currentValue), {
        title,
        placeHolder: constants.editConfigArrayPlaceHolder,
        canPickMany: true,
        ignoreFocusOut: true
      });
      if (picked === undefined) {
        return;
      }
      newValue = picked.map((item) => item.label);
    } else {
      const input = await vscode.window.showInputBox({
        title,
        placeHolder: constants.editConfigStringPlaceHolder,
        value: currentValue !== undefined && currentValue !== null ? `${currentValue}` : "",
        ignoreFocusOut: true
      });
      if (input === undefined) {
        return;
      }
      newValue = input;
    }
    await Configuration.save({ [label]: newValue });
  } catch (error) {
    showErrorMessageWithDetail(constants.editConfigFailed, error);
  }
};
