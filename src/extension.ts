import * as vscode from 'vscode';
import { abortAllAsync } from './commands/abortAllAsync';
import { activeAsync } from './commands/activeAsync';
import { activeBySessionAsync } from './commands/activeBySessionAsync';
import { activeByTerminalAsync } from './commands/activeByTerminalAsync';
import { addVariableAsync } from './commands/addVariableAsync';
import { clearAllAsync } from './commands/clearAllAsync';
import { editVariableAsync } from './commands/editVariableAsync';
import { generateAsync } from './commands/generateAsync';
import { importAsync } from './commands/importAsync';
import { killAllAsync } from './commands/killAllAsync';
import { migrateAsync } from './commands/migrateAsync';
import { navigateAsync } from './commands/navigateAsync';
import { openAsync } from './commands/openAsync';
import { removeAsync } from './commands/removeAsync';
import { removeVariableAsync } from './commands/removeVariableAsync';
import { runTerminalByNameAsync } from './commands/runTerminalByNameAsync';
import { saveAsync } from './commands/saveAsync';
import { Configuration } from './configuration/configuration';
import { registerSchemaProvider, schemaUri } from './configuration/schemaProvider';
import { TreeProvider } from './explorer/tree-provider';
import { extCommands, ACTIVITY_VIEW_ID, sysCommands, constants } from './utils/constants';

export async function activate(context: vscode.ExtensionContext) {
  await Configuration.initialize();
  registerSchemaProvider(context);
  context.subscriptions.push(
    // Generate the configuration
    vscode.commands.registerCommand(extCommands.generate, async (...args) => {
      await generateAsync();
    }),
    // Open terminal session
    vscode.commands.registerCommand(extCommands.open, async (...args) => {
      await openAsync();
    }),
    // Active terminal session
    vscode.commands.registerCommand(extCommands.active, async (...args) => {
      const uri = args?.[0];
      const cwd = uri?.fsPath;
      await activeAsync(cwd);
    }),
    // Save terminal session
    vscode.commands.registerCommand(extCommands.save, async (...args) => {
      await saveAsync();
    }),
    // Remove terminal session
    vscode.commands.registerCommand(extCommands.remove, async (...args) => {
      await removeAsync();
    }),
    // Migrate terminal session
    vscode.commands.registerCommand(extCommands.migrate, async (...args) => {
      await migrateAsync();
    }),
    // Clear all terminals
    vscode.commands.registerCommand(extCommands.clearAll, async (...args) => {
      await clearAllAsync();
    }),
    // Abort all terminals
    vscode.commands.registerCommand(extCommands.abortAll, async (...args) => {
      await abortAllAsync();
    }),
    // Kill all terminals
    vscode.commands.registerCommand(extCommands.killAll, async (...args) => {
      await killAllAsync();
    }),
    // Run terminal by name
    vscode.commands.registerCommand(extCommands.runTerminalByName, async (args) => {
      await runTerminalByNameAsync(args);
    })
  );
  const treeProvider = new TreeProvider();
  vscode.window.registerTreeDataProvider(ACTIVITY_VIEW_ID, treeProvider);
  context.subscriptions.push(
    vscode.commands.registerCommand(extCommands.refresh, async () => treeProvider.refresh()),
    vscode.commands.registerCommand(extCommands.activeSessionActivity, async (sessionTreeItem) => {
      const { sessionId } = sessionTreeItem;
      await activeBySessionAsync(sessionId, true);
    }),
    vscode.commands.registerCommand(extCommands.collapseAllActivity, async () => {
      await vscode.commands.executeCommand(sysCommands.activityCollapseAll);
    }),
    vscode.commands.registerCommand(extCommands.navigateActivity, async (sessionTreeItem) => {
      await navigateAsync(sessionTreeItem);
    }),
    vscode.commands.registerCommand(extCommands.helpAndFeedbackActivity, async () => {
      await vscode.env.openExternal(vscode.Uri.parse(constants.helpAndFeedbackUrl));
    }),
    vscode.commands.registerCommand(extCommands.sendToNewTerminalActivity, async (sessionTreeItem) => {
      const { sessionId, terminalArrayIndex, label, contextValue } = sessionTreeItem;
      if (contextValue === "terminal-array-context") {
        await activeByTerminalAsync(sessionId, terminalArrayIndex, undefined);
      } else {
        await activeByTerminalAsync(sessionId, terminalArrayIndex, label);
      }
    }),
    vscode.commands.registerCommand(extCommands.sendToCurrentTerminalActivity, async (sessionTreeItem) => {
      const { sessionId, terminalArrayIndex, label, description } = sessionTreeItem;
      const { activeTerminal } = vscode.window;
      if (activeTerminal) {
        activeTerminal.sendText(`${description || ""}`, false);
      } else {
        await activeByTerminalAsync(sessionId, terminalArrayIndex, label);
      }
    }),
    vscode.commands.registerCommand(extCommands.copyCommandActivity, async (sessionTreeItem) => {
      const { description } = sessionTreeItem;
      vscode.env.clipboard.writeText(`${description || ""}`);
    }),
    vscode.commands.registerCommand(extCommands.importFromNPMActivity, async () => {
      await importAsync("npm");
    }),
    vscode.commands.registerCommand(extCommands.importFromComposerActivity, async () => {
      await importAsync("composer");
    }),
    vscode.commands.registerCommand(extCommands.importFromMakeActivity, async () => {
      await importAsync("make");
    }),
    vscode.commands.registerCommand(extCommands.importFromGradleActivity, async () => {
      await importAsync("gradle");
    }),
    vscode.commands.registerCommand(extCommands.importFromPipenvActivity, async () => {
      await importAsync("pipenv");
    }),
    vscode.commands.registerCommand(extCommands.importFromAntActivity, async () => {
      await importAsync("ant");
    }),
    vscode.commands.registerCommand(extCommands.importFromGruntActivity, async () => {
      await importAsync("grunt");
    }),
    vscode.commands.registerCommand(extCommands.importFromGulpActivity, async () => {
      await importAsync("gulp");
    }),
    vscode.commands.registerCommand(extCommands.addVariableActivity, async () => {
      await addVariableAsync();
    }),
    vscode.commands.registerCommand(extCommands.editVariableActivity, async (variableTreeItem) => {
      await editVariableAsync(variableTreeItem);
    }),
    vscode.commands.registerCommand(extCommands.removeVariableActivity, async (variableTreeItem) => {
      await removeVariableAsync(variableTreeItem);
    })
  );
  Configuration.watch(() => treeProvider.refresh());
  const { $schema = "", activateOnStartup = false, active } = await Configuration.load();
  if ($schema && $schema !== schemaUri.toString()) {
    await vscode.commands.executeCommand(extCommands.migrate);
  }
  if (activateOnStartup) {
    await activeBySessionAsync(active);
  }
}
export async function deactivate() {
  vscode.window.showInformationMessage("[Terminal Organizer] Goodbye.");
}
