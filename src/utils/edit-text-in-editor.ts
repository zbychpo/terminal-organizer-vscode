import * as vscode from 'vscode';

// Multi-line text can't be edited in an InputBox, so it's opened as a
// temporary file (in the extension's global storage) in a regular editor.
// Every save (Ctrl+S) hands the text to onSave; closing the editor deletes
// the temporary file.

var storageUri: vscode.Uri | undefined;

export var setEditTextStorageUri = (uri: vscode.Uri) => {
  storageUri = uri;
};

var toSafeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "text";

export var editTextInEditor = async (params: { fileName: string; initialText: string; onSave: (text: string) => Promise<void> }) => {
  if (!storageUri) {
    throw new Error("The storage for temporary editor files isn't initialized.");
  }
  const directory = vscode.Uri.joinPath(storageUri, "edit");
  await vscode.workspace.fs.createDirectory(directory);
  const fileUri = vscode.Uri.joinPath(directory, toSafeFileName(params.fileName));
  await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(params.initialText));
  const document = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(document, { preview: false });

  const isOurDocument = (doc: vscode.TextDocument) => doc.uri.toString() === fileUri.toString();
  const subscriptions: vscode.Disposable[] = [];
  subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (isOurDocument(doc)) {
        await params.onSave(doc.getText().replace(/\r\n/g, "\n"));
      }
    }),
    vscode.workspace.onDidCloseTextDocument(async (doc) => {
      if (!isOurDocument(doc)) {
        return;
      }
      subscriptions.forEach((d) => d.dispose());
      try {
        await vscode.workspace.fs.delete(fileUri);
      } catch {
        // Already gone - nothing to clean up.
      }
    })
  );
};
