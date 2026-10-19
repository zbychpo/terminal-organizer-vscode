import * as vscode from 'vscode';
import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail, showGenerateConfiguration } from '../utils/utils';

var getFileUriBySource = (configuration: Configuration, source) => {
  if (source === "settings.json") {
    return vscode.Uri.file(configuration.getSettingsFilePath());
  }
  return vscode.Uri.file(configuration.sessionFilePath);
};
var escapeRegExp = (input) => {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};
var getKeywordRegex = (treeItem) => {
  const { keywords = [] } = treeItem;
  const enhanceKeywords = keywords.map((keyword) => {
    let enhanceKeyword = escapeRegExp(keyword).replace(`: `, `: ?`).replace(`"`, `(?:'|")`);
    return enhanceKeyword;
  });
  return new RegExp(enhanceKeywords.join("|"), "gm");
};
export var navigateAsync = async (treeItem) => {
  try {
    const configuration = await Configuration.resolve(treeItem);
    if (!configuration) {
      return;
    }
    const isDefinedSessionFile = await configuration.isDefinedSessionFile();
    if (!isDefinedSessionFile) {
      await showGenerateConfiguration(configuration);
      return;
    }
    const { source } = treeItem;
    const sessionFileUri = getFileUriBySource(configuration, source);
    const document = await vscode.workspace.openTextDocument(sessionFileUri);
    const content = document.getText();
    const regex = getKeywordRegex(treeItem);
    const matches = [...content.matchAll(regex)];
    let selections = [];
    matches.forEach((match2) => {
      if (match2.index) {
        const startPosition = document.positionAt(match2.index);
        const endPosition = document.positionAt(match2.index + match2[0].length);
        selections.push(new vscode.Selection(startPosition, endPosition));
      }
    });
    await vscode.window.showTextDocument(document, { selection: selections?.[0] });
  } catch (error) {
    showErrorMessageWithDetail(constants.openConfigurationFailed, error);
  }
};
