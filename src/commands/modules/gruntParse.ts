import * as vscode from 'vscode';

var getFileContent = async (filePath) => {
  const document = await vscode.workspace.openTextDocument(filePath);
  return document.getText();
};
var getCommand = () => {
  return "npm grunt";
};
var buildCommands = (contents) => {
  const scripts = {};
  const cmd = getCommand();
  let idx = 0;
  let eol = contents.indexOf("\n", 0);
  while (eol !== -1) {
    let line = contents.substring(idx, eol).trim();
    if (line.length > 0 && line.toLowerCase().trimStart().startsWith("grunt.registertask")) {
      let idx1 = line.indexOf("'");
      if (idx1 === -1) {
        idx1 = line.indexOf('"');
      }
      if (idx1 === -1) {
        let eol2 = eol + 1;
        eol2 = contents.indexOf("\n", eol2);
        line = contents.substring(eol + 1, eol2).trim();
        if (line.startsWith("'") || line.startsWith('"')) {
          idx1 = line.indexOf("'");
          if (idx1 === -1) {
            idx1 = line.indexOf('"');
          }
          if (idx1 !== -1) {
            eol = eol2;
          }
        }
      }
      if (idx1 !== -1) {
        idx1++;
        let idx2 = line.indexOf("'", idx1);
        if (idx2 === -1) {
          idx2 = line.indexOf('"', idx1);
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
export var extractGruntCommands = async (filePath) => {
  const content = await getFileContent(filePath);
  return buildCommands(content);
};
