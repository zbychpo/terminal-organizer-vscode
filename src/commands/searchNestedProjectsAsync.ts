import * as vscode from 'vscode';
import { Configuration, NestedProjectCandidate } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

// Searches every subfolder of the workspace folders for sessions files and
// lets the user check which ones to show as nested projects. The checked
// ones are saved in each workspace folder's nestedProjects setting; entries
// for subfolders without a sessions file (typed in by hand) are kept.
export var searchNestedProjectsAsync = async () => {
  try {
    const folders = vscode.workspace.workspaceFolders || [];
    if (folders.length === 0) {
      vscode.window.showWarningMessage(constants.openWorkspace);
      return;
    }
    const found = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: constants.searchNestedProjectsProgress, cancellable: true },
      (_progress, token) => Configuration.searchNestedProjects(token)
    );
    if (found.length === 0) {
      vscode.window.showInformationMessage(constants.searchNestedProjectsNoneFound);
      return;
    }
    const autoDetected = new Set(
      Configuration.all()
        .filter((s) => s.kind === "nested" && s.autoDetected)
        .map((s) => s.id)
    );
    const idOf = (c: NestedProjectCandidate) => vscode.Uri.joinPath(c.folder.uri, ...c.relativePath.split("/")).toString();
    const items = found.map((candidate) => {
      const isAuto = autoDetected.has(idOf(candidate));
      return {
        label: `$(folder) ${folders.length > 1 ? `${candidate.folder.name}/` : ""}${candidate.relativePath}`,
        description: isAuto ? constants.searchNestedProjectsAutoDetected : undefined,
        detail: candidate.sessionFilePath,
        picked: isAuto || Configuration.getNestedProjects(candidate.folder).includes(candidate.relativePath),
        candidate,
        isAuto
      };
    });
    const picked = await vscode.window.showQuickPick(items, {
      title: constants.searchNestedProjectsTitle,
      placeHolder: constants.searchNestedProjectsPlaceholder,
      canPickMany: true,
      ignoreFocusOut: true,
      matchOnDetail: true
    });
    if (!picked) {
      return;
    }
    const pickedSet = new Set(picked.map((p) => p.candidate));
    for (const folder of folders) {
      const foundHere = found.filter((c) => c.folder === folder).map((c) => c.relativePath);
      const kept = Configuration.getNestedProjects(folder).filter((rel) => !foundHere.includes(rel));
      const checked = found.filter((c) => c.folder === folder && pickedSet.has(c)).map((c) => c.relativePath);
      const next = [...new Set([...kept, ...checked])];
      const current = Configuration.getNestedProjects(folder);
      if (next.length !== current.length || next.some((rel) => !current.includes(rel))) {
        await Configuration.setNestedProjects(folder, next);
      }
    }
    const stillAuto = items.filter((item) => item.isAuto && !pickedSet.has(item.candidate));
    if (stillAuto.length > 0) {
      vscode.window.showInformationMessage(
        constants.searchNestedProjectsStillAutoDetected
          .replace("{count}", String(stillAuto.length))
          .replace("{depth}", String(Configuration.getNestedScanDepth(stillAuto[0].candidate.folder)))
      );
    }
  } catch (error) {
    showErrorMessageWithDetail(constants.searchNestedProjectsFailed, error);
  }
};
