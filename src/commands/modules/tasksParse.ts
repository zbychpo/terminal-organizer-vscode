import * as vscode from 'vscode';
import { parse as parseJsonc } from 'jsonc-parser';

var getFileContent = async (filePath) => {
  const document = await vscode.workspace.openTextDocument(filePath);
  return document.getText();
};
var buildCommandFromTask = (task) => {
  if (task.type === "npm" && task.script && typeof task.command !== "string") {
    return `npm run ${task.script}`;
  }
  if (typeof task.command !== "string") {
    return undefined;
  }
  const args = Array.isArray(task.args) ? task.args.filter((arg) => typeof arg === "string") : [];
  return [task.command, ...args].join(" ");
};
export var buildCommands = (contents) => {
  const scripts = {};
  const tasksFile = parseJsonc(contents) || {};
  const tasks = Array.isArray(tasksFile.tasks) ? tasksFile.tasks : [];
  tasks.forEach((task) => {
    const label = task?.label || task?.taskName;
    const command = buildCommandFromTask(task || {});
    if (label && command) {
      scripts[label] = [command];
    }
  });
  return scripts;
};
export var extractTasksCommands = async (filePath) => {
  const content = await getFileContent(filePath);
  return buildCommands(content);
};
