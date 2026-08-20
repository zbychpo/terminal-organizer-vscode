import * as fsBrowserify from '@vscode-utility/fs-browserify';
import * as childProcess from 'child_process';
import * as path from 'path';
import * as util from 'util';
import * as vscode from 'vscode';

var execPromise = util.promisify(childProcess.exec);
var wslPathToWindowsPath = async (workspacePath, distro) => {
  const { stdout } = await execPromise(`wsl.exe -d ${distro} wslpath -w '${workspacePath}'`);
  return stdout.trim();
};
export var getWorkspaceRootPath = async (uri?) => {
  const workspaceFolderUri = uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!workspaceFolderUri) {
    return undefined;
  }
  const isSSHRemote = workspaceFolderUri.authority.startsWith("ssh-remote+");
  if (isSSHRemote) {
    const isWindows = !!workspaceFolderUri.path.match(/^\/[a-zA-Z]:\/.*$/);
    return isWindows ? workspaceFolderUri.path.substring(1) : workspaceFolderUri.path;
  }
  const isDevContainer = workspaceFolderUri.authority.startsWith("dev-container+");
  if (isDevContainer) {
    return path.dirname(workspaceFolderUri.path);
  }
  let cwd = workspaceFolderUri.fsPath;
  const isWSL = workspaceFolderUri.authority.startsWith("wsl+");
  if (isWSL) {
    const distro = workspaceFolderUri.authority.split("+")[1];
    cwd = await wslPathToWindowsPath(workspaceFolderUri.path, distro);
  }
  const stat = await vscode.workspace.fs.stat(vscode.Uri.file(cwd));
  return stat.type === vscode.FileType.File ? path.dirname(cwd) : cwd;
};
