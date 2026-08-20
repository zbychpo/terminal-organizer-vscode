import * as fsBrowserify from '@vscode-utility/fs-browserify';

var getFileContent = async (filePath) => {
  return await fsBrowserify.fs.readFileAsync(filePath);
};
var buildCommands = (contents) => {
  const scripts = {};
  const packageJson = JSON.parse(contents);
  Object.entries(packageJson?.scripts ?? {}).forEach(([name, command]) => {
    scripts[name] = Array.isArray(command) ? command : [command];
  });
  return scripts;
};
export var extractJsonScriptCommands = async (filePath) => {
  const content = await getFileContent(filePath);
  return buildCommands(content);
};
