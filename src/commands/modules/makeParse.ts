import * as vscode from 'vscode';

var getFileContent = async (filePath) => {
  const document = await vscode.workspace.openTextDocument(filePath);
  return document.getText();
};
var suffixRuleTargets = /^(\.\w+|\.\w+\.\w+)$/;
var patternRuleTargets = /^(%\.\w+|%)$/;
var ruleTargetExp = /^([\w-.\/ ]+)\s*:[^=]/gm;
var specialTargets = /* @__PURE__ */ new Set([
  // https://www.gnu.org/software/make/manual/html_node/Special-Targets.html
  ".PHONY",
  ".SUFFIXES",
  ".DEFAULT",
  ".PRECIOUS",
  ".INTERMEDIATE",
  ".SECONDARY",
  ".SECONDEXPANSION",
  ".DELETE_ON_ERROR",
  ".IGNORE",
  ".LOW_RESOLUTION_TIME",
  ".SILENT",
  ".EXPORT_ALL_VARIABLES",
  ".NOTPARALLEL",
  ".ONESHELL",
  ".POSIX",
  ".MAKE"
]);
var isNormalTarget = (target) => {
  if (specialTargets.has(target)) {
    return false;
  }
  if (suffixRuleTargets.test(target)) {
    return false;
  }
  if (patternRuleTargets.test(target)) {
    return false;
  }
  return true;
};
var getCommand = () => {
  let make = "make";
  if (process.platform === "win32") {
    make = "nmake";
  }
  return make;
};
var buildCommands = (contents) => {
  const scripts = {};
  const cmd = getCommand();
  let match2;
  while (match2 = ruleTargetExp.exec(contents)) {
    const tgtName = match2[1];
    if (tgtName.startsWith(".")) {
      continue;
    }
    if (isNormalTarget(tgtName)) {
      scripts[tgtName] = [`${cmd} ${tgtName}`];
    }
  }
  return scripts;
};
export var extractMakeCommands = async (filePath) => {
  const content = await getFileContent(filePath);
  return buildCommands(content);
};
