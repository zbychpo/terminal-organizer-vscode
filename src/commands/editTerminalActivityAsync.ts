import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants, terminalFieldDescriptions } from '../utils/constants';
import { collectAllTerminalNames, showErrorMessageWithDetail } from '../utils/utils';
import { pickVariableValue } from '../utils/pick-variable-value';
import { vscodeIcons } from '../utils/vscode-icons';

const colorOptions = [
  "terminal.ansiBlack", "terminal.ansiBlue", "terminal.ansiBrightBlack", "terminal.ansiBrightBlue",
  "terminal.ansiBrightCyan", "terminal.ansiBrightGreen", "terminal.ansiBrightMagenta", "terminal.ansiBrightRed",
  "terminal.ansiBrightWhite", "terminal.ansiBrightYellow", "terminal.ansiCyan", "terminal.ansiGreen",
  "terminal.ansiMagenta", "terminal.ansiRed", "terminal.ansiWhite", "terminal.ansiYellow"
];

const fieldOrder = [
  "name", "commands", "cwd", "color", "icon", "env", "joinOperator", "shellPath",
  "shellArgs", "message", "disabled", "autoExecuteCommands", "focus", "hideFromUser",
  "isTransient", "strictEnv"
];
const booleanFields = ["disabled", "autoExecuteCommands", "focus", "hideFromUser", "isTransient", "strictEnv"];
const jsonStringArrayFields = ["commands", "shellArgs"];
const pathFields = ["cwd", "shellPath"];

export var applyTerminalFieldUpdate = (terminal, field, value) => {
  const updated = { ...terminal };
  if (value === undefined || value === "") {
    delete updated[field];
    return updated;
  }
  updated[field] = value;
  return updated;
};

export var describeField = (terminal, field) => {
  const value = terminal[field];
  if (booleanFields.includes(field)) {
    return value ? "Yes" : "No";
  }
  if (jsonStringArrayFields.includes(field)) {
    return Array.isArray(value) && value.length > 0 ? value.join(" | ") : "(none)";
  }
  if (field === "env") {
    return value && Object.keys(value).length > 0 ? JSON.stringify(value) : "(none)";
  }
  if (field === "color" || field === "icon") {
    return value ?? "(theme default)";
  }
  return value ?? "(not set)";
};

export var validateJsonStringArray = (value) => {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
      return constants.editTerminalJsonArrayInvalid;
    }
    return "";
  } catch {
    return constants.editTerminalJsonArrayInvalid;
  }
};

export var validateJsonStringRecord = (value) => {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed) || !Object.values(parsed).every((item) => typeof item === "string")) {
      return constants.editTerminalEnvInvalid;
    }
    return "";
  } catch {
    return constants.editTerminalEnvInvalid;
  }
};

export var editTerminalActivityAsync = async (terminalTreeItem) => {
  try {
    const { sessionId, terminalArrayIndex, label } = terminalTreeItem || {};
    if (!sessionId || terminalArrayIndex === undefined) {
      return;
    }
    const configuration = await Configuration.resolve(terminalTreeItem);
    if (!configuration) {
      return;
    }
    const config = await configuration.load();
    if (!config?.sessions) {
      return;
    }
    const { sessions } = config;
    const session = sessions[sessionId];
    const sessionItem = session?.[terminalArrayIndex];
    if (!sessionItem) {
      return;
    }
    const isGroup = Array.isArray(sessionItem);
    const terminalIndexInGroup = isGroup ? sessionItem.findIndex((t) => t.name === label) : -1;
    const terminal = isGroup ? sessionItem[terminalIndexInGroup] : sessionItem;
    if (!terminal) {
      return;
    }

    const title = constants.editTerminalFieldTitle.replace("{name}", terminal.name);
    const fieldItems = fieldOrder.map((field) => ({
      label: field,
      description: `${describeField(terminal, field)}`,
      detail: terminalFieldDescriptions[field]
    }));
    const pickedField = await vscode.window.showQuickPick(fieldItems, {
      title,
      placeHolder: constants.editTerminalFieldPlaceHolder,
      ignoreFocusOut: true,
      matchOnDetail: true
    });
    if (!pickedField) {
      return;
    }
    const field = pickedField.label;
    const fieldDescription = terminalFieldDescriptions[field];

    let newValue;
    if (booleanFields.includes(field)) {
      const picked = await vscode.window.showQuickPick(
        [
          { label: constants.yesButton, value: true },
          { label: constants.noButton, value: false }
        ],
        { title, placeHolder: fieldDescription, ignoreFocusOut: true }
      );
      if (!picked) {
        return;
      }
      newValue = picked.value;
    } else if (field === "color") {
      const picked = await vscode.window.showQuickPick(
        [{ label: constants.editTerminalClearOption }, ...colorOptions.map((color) => ({ label: color }))],
        { title, placeHolder: fieldDescription, ignoreFocusOut: true }
      );
      if (!picked) {
        return;
      }
      newValue = picked.label === constants.editTerminalClearOption ? undefined : picked.label;
    } else if (field === "icon") {
      const picked = await vscode.window.showQuickPick(
        [
          { label: constants.editTerminalClearOption },
          ...vscodeIcons.map((icon) => ({ label: icon, iconPath: new vscode.ThemeIcon(icon) }))
        ],
        { title, placeHolder: fieldDescription, ignoreFocusOut: true }
      );
      if (!picked) {
        return;
      }
      newValue = picked.label === constants.editTerminalClearOption ? undefined : picked.label;
    } else if (pathFields.includes(field)) {
      newValue = await pickVariableValue(terminal[field] || "", {
        title,
        placeholder: fieldDescription
      });
      if (newValue === undefined) {
        return;
      }
    } else if (jsonStringArrayFields.includes(field)) {
      const input = await vscode.window.showInputBox({
        title,
        prompt: fieldDescription,
        placeHolder: constants.editTerminalJsonArrayPlaceHolder,
        value: JSON.stringify(terminal[field] || []),
        ignoreFocusOut: true,
        validateInput: validateJsonStringArray
      });
      if (input === undefined) {
        return;
      }
      newValue = JSON.parse(input);
    } else if (field === "env") {
      const input = await vscode.window.showInputBox({
        title,
        prompt: fieldDescription,
        placeHolder: constants.editTerminalEnvPlaceHolder,
        value: JSON.stringify(terminal.env || {}),
        ignoreFocusOut: true,
        validateInput: validateJsonStringRecord
      });
      if (input === undefined) {
        return;
      }
      const parsed = JSON.parse(input);
      newValue = Object.keys(parsed).length > 0 ? parsed : undefined;
    } else if (field === "name") {
      const allTerminalNames = collectAllTerminalNames(sessions);
      allTerminalNames.delete(terminal.name);
      const input = await vscode.window.showInputBox({
        title,
        prompt: fieldDescription,
        placeHolder: constants.editTerminalNamePlaceHolder,
        value: terminal.name || "",
        ignoreFocusOut: true,
        validateInput: (value) => {
          if (!value) {
            return constants.terminalNameNotEmpty;
          }
          if (allTerminalNames.has(value)) {
            return constants.terminalNameIsDuplicated;
          }
          return "";
        }
      });
      if (!input) {
        return;
      }
      newValue = input;
    } else {
      const input = await vscode.window.showInputBox({
        title,
        prompt: fieldDescription,
        placeHolder: fieldDescription,
        value: terminal[field] || "",
        ignoreFocusOut: true
      });
      if (input === undefined) {
        return;
      }
      newValue = input;
    }

    const updatedTerminal = applyTerminalFieldUpdate(terminal, field, newValue);
    if (isGroup) {
      sessionItem[terminalIndexInGroup] = updatedTerminal;
    } else {
      session[terminalArrayIndex] = updatedTerminal;
    }
    await configuration.save({ sessions });
  } catch (error) {
    showErrorMessageWithDetail(constants.editTerminalFailed, error);
  }
};
