import * as vscode from 'vscode';

var getFileContent = async (filePath) => {
  const document = await vscode.workspace.openTextDocument(filePath);
  return document.getText();
};
var getCommand = () => {
  let gradle = "gradlew";
  if (process.platform === "win32") {
    gradle = "gradlew.bat";
  }
  return gradle;
};
var buildCommands = (contents) => {
  const scripts = {};
  const cmd = getCommand();
  let idx = 0;
  let eol = contents.indexOf("\n", 0);
  while (eol !== -1) {
    const line = contents.substring(idx, eol).trim();
    if (line.length > 0 && line.toLowerCase().trimStart().startsWith("task ")) {
      let idx1 = line.trimStart().indexOf(" ");
      if (idx1 !== -1) {
        idx1++;
        let idx2 = line.indexOf("(", idx1);
        if (idx2 === -1) {
          idx2 = line.indexOf("{", idx1);
        }
        if (idx2 !== -1) {
          const tgtName = line.substring(idx1, idx2).trim();
          if (tgtName) {
            scripts[tgtName] = [`${cmd} ${tgtName}`];
          }
        }
      }
    }
    idx = eol + 1;
    eol = contents.indexOf("\n", idx);
  }
  return scripts;
};
export var extractGradleCommands = async (filePath) => {
  const content = await getFileContent(filePath);
  return buildCommands(content);
};
