import * as vscode from 'vscode';
import * as xml2js from 'xml2js';

var getFileContent = async (filePath) => {
  const document = await vscode.workspace.openTextDocument(filePath);
  return document.getText();
};
var getCommand = () => {
  let ant = "ant";
  if (process.platform === "win32") {
    ant = "ant.bat";
  }
  return ant;
};
var buildCommands = async (contents) => {
  const scripts = {};
  const cmd = getCommand();
  const text = await (0, xml2js.parseStringPromise)(contents);
  if (text && text.project && text.project.target) {
    const defaultTask = text.project.$.default;
    const targets = text.project.target;
    for (const tgt of targets) {
      if (tgt.$ && tgt.$.name) {
        const name = defaultTask === tgt.$.name ? tgt.$.name + " - Default" : tgt.$.name;
        scripts[name] = [`${cmd} ${tgt.$.name}`];
      }
    }
  }
  return scripts;
};
export var extractAntCommands = async (filePath) => {
  const content = await getFileContent(filePath);
  return await buildCommands(content);
};
