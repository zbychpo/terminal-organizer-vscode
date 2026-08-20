import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        const extensionTestsPath = path.resolve(__dirname, './suite/index');
        // Configuration.initialize() needs an open workspace folder to locate
        // .vscode/sessions.json - without one, every config-touching test
        // would silently no-op.
        const testWorkspace = path.resolve(__dirname, '../../.vscode-test/sample-workspace');

        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                testWorkspace,
                // Load only the extension under test - no other installed/built-in
                // extensions, so results aren't affected by unrelated extensions.
                '--disable-extensions'
            ]
        });
    } catch (err) {
        console.error('Failed to run tests');
        console.error(err);
        process.exit(1);
    }
}

main();
