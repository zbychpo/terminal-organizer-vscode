import * as bombadil from '@sgarciac/bombadil';
import * as vscode from 'vscode';

var getFileContent = async (filePath) => {
  const document = await vscode.workspace.openTextDocument(filePath);
  return document.getText();
};
var getCommand = () => {
  const pythonPath = vscode.workspace.getConfiguration("python").get("pythonPath", "python");
  const gradle = `${pythonPath} -m pipenv run`;
  return gradle;
};
var buildCommands = (contents) => {
  const scripts = {};
  const cmd = getCommand();
  const pipfile = new bombadil.TomlReader();
  pipfile.readToml(contents);
  Object.entries(pipfile.result?.scripts ?? {}).forEach(([scriptName, _scriptCmd]) => {
    scripts[scriptName] = [`${cmd} ${scriptName}`];
  });
  return scripts;
};
export var extractPipenvCommands = async (filePath) => {
  const content = await getFileContent(filePath);
  return buildCommands(content);
};
