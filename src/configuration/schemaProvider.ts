import * as vscode from 'vscode';
import { configFileVersions } from './interface';

export const schemaScheme = 'terminal-organizer-vscode-schema';
// Keeps the "/v11/"-style version segment in the URI so the existing
// `$schema.includes(configFileVersions.latest)` check in extension.ts and
// migrateAsync.ts keeps working unchanged.
export const schemaUri = vscode.Uri.parse(`${schemaScheme}:${configFileVersions.latest}terminal-organizer-vscode.json`);

export function registerSchemaProvider(context: vscode.ExtensionContext) {
  const provider: vscode.TextDocumentContentProvider = {
    async provideTextDocumentContent(uri: vscode.Uri) {
      const fileUri = vscode.Uri.joinPath(context.extensionUri, 'schema', 'terminal-organizer-vscode.json');
      const bytes = await vscode.workspace.fs.readFile(fileUri);
      return new TextDecoder('utf-8').decode(bytes);
    }
  };
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(schemaScheme, provider)
  );
}
