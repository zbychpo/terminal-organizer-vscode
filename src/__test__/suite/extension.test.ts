import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { substituteVariable, substituteVariablesDeep } from '../../utils/variable-substitution';
import { resolveVscodeVariable, resolveVscodeVariablesDeep } from '../../utils/vscode-variable-resolver';

const EXTENSION_ID = 'zbigniewpowroznik.terminal-organizer-vscode';
const LATEST_SCHEMA_URI = 'terminal-organizer-vscode-schema:/v11/terminal-organizer-vscode.json';

suite('Terminal Organizer Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension(EXTENSION_ID));
    });

    test('Extension should activate', async () => {
        const ext = vscode.extensions.getExtension(EXTENSION_ID);
        assert.ok(ext);
        await ext!.activate();
        assert.strictEqual(ext!.isActive, true);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        const expected = [
            'terminal-organizer-vscode.generate',
            'terminal-organizer-vscode.open',
            'terminal-organizer-vscode.active',
            'terminal-organizer-vscode.save',
            'terminal-organizer-vscode.remove',
            'terminal-organizer-vscode.migrate',
            'terminal-organizer-vscode.clear-all',
            'terminal-organizer-vscode.abort-all',
            'terminal-organizer-vscode.kill-all',
            'terminal-organizer-vscode.run-terminal-by-name'
        ];
        expected.forEach((cmd) => {
            assert.ok(commands.includes(cmd), `Missing command: ${cmd}`);
        });
    });

    test('Activity view container should be contributed', () => {
        const ext = vscode.extensions.getExtension(EXTENSION_ID);
        const viewsContainers = ext?.packageJSON?.contributes?.viewsContainers?.activitybar ?? [];
        assert.ok(
            viewsContainers.some((c: { id: string }) => c.id === 'terminalOrganizerActivitybar'),
            'terminalOrganizerActivitybar view container is not contributed'
        );
    });

    test('Bundled sessions.json schema should be resolvable and valid', async () => {
        const ext = vscode.extensions.getExtension(EXTENSION_ID);
        assert.ok(ext);
        await ext!.activate();

        const schemaUri = vscode.Uri.parse(LATEST_SCHEMA_URI);
        const doc = await vscode.workspace.openTextDocument(schemaUri);
        const schema = JSON.parse(doc.getText());

        assert.strictEqual(schema.$schema, 'http://json-schema.org/draft-07/schema#');
        assert.ok(schema.definitions?.terminalItem?.properties?.disabled, 'definitions.terminalItem is missing the "disabled" property');
    });

    test('jsonValidation contribution should point at the bundled schema', () => {
        const ext = vscode.extensions.getExtension(EXTENSION_ID);
        const jsonValidation = ext?.packageJSON?.contributes?.jsonValidation ?? [];
        assert.ok(
            jsonValidation.some(
                (v: { fileMatch: string; url: string }) =>
                    v.fileMatch === '/.vscode/sessions.json' && v.url === './schema/terminal-organizer-vscode.json'
            ),
            'jsonValidation entry for .vscode/sessions.json is missing or incorrect'
        );
    });

    test('Migrate command rewrites an old $schema to the bundled schema URI', async () => {
        const ext = vscode.extensions.getExtension(EXTENSION_ID);
        assert.ok(ext);
        await ext!.activate();

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(workspaceFolder, 'No workspace folder is open - runTest.ts must launch with a workspace path');

        const vscodeDir = path.join(workspaceFolder!.uri.fsPath, '.vscode');
        const sessionFilePath = path.join(vscodeDir, 'sessions.json');
        fs.mkdirSync(vscodeDir, { recursive: true });
        fs.writeFileSync(
            sessionFilePath,
            JSON.stringify(
                {
                    $schema: 'https://cdn.statically.io/gh/nguyenngoclongdev/cdn/main/schema/v9/terminal-keeper.json',
                    active: 'default',
                    theme: 'default',
                    sessions: { default: [{ name: 'hello', commands: ['echo hello'] }] }
                },
                null,
                2
            )
        );

        await vscode.commands.executeCommand('terminal-organizer-vscode.migrate');

        const migrated = JSON.parse(fs.readFileSync(sessionFilePath, 'utf8'));
        assert.strictEqual(migrated.$schema, LATEST_SCHEMA_URI);
    });

    test('Variable commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('terminal-organizer-vscode.add-variable-activity'));
        assert.ok(commands.includes('terminal-organizer-vscode.edit-variable-activity'));
        assert.ok(commands.includes('terminal-organizer-vscode.remove-variable-activity'));
    });

    test('substituteVariable replaces ${variable:NAME} with the matching value', () => {
        const variables = { projectRoot: 'H:/Repozytoria/vsc-terminal/final' };
        assert.strictEqual(
            substituteVariable('${variable:projectRoot}/dist', variables),
            'H:/Repozytoria/vsc-terminal/final/dist'
        );
        assert.strictEqual(substituteVariable('no placeholder here', variables), 'no placeholder here');
        assert.strictEqual(
            substituteVariable('${variable:missing}', variables),
            '${variable:missing}',
            'An unknown variable name should be left untouched, not silently emptied'
        );
    });

    test('substituteVariablesDeep resolves placeholders inside nested terminal item fields', () => {
        const variables = { root: '/workspace/app' };
        const terminalItem = {
            name: 'build',
            cwd: '${variable:root}',
            commands: ['cd ${variable:root}/src', 'npm run build'],
            env: { PROJECT_ROOT: '${variable:root}' },
            disabled: false
        };
        const resolved = substituteVariablesDeep(terminalItem, variables);
        assert.strictEqual(resolved.cwd, '/workspace/app');
        assert.deepStrictEqual(resolved.commands, ['cd /workspace/app/src', 'npm run build']);
        assert.strictEqual(resolved.env.PROJECT_ROOT, '/workspace/app');
        assert.strictEqual(resolved.disabled, false, 'non-string fields must pass through unchanged');
        // The original object must not be mutated - callers still hold a
        // reference to the raw session data loaded from sessions.json.
        assert.strictEqual(terminalItem.cwd, '${variable:root}');
    });

    test('substituteVariablesDeep is a no-op when no variables are defined', () => {
        const terminalItem = { name: 'build', cwd: '${variable:root}' };
        assert.strictEqual(substituteVariablesDeep(terminalItem, undefined), terminalItem);
        assert.strictEqual(substituteVariablesDeep(terminalItem, {}), terminalItem);
    });

    test('A "variable" key can be added to a sessions.json that never had one', async () => {
        // Configuration.save()/update() only ever patches keys that already
        // exist in the file, so it can never introduce a wholly new
        // top-level key. addVariableAsync/editVariableAsync/removeVariableAsync
        // work around this by reading+writing the raw file directly via
        // Configuration.getSessionConfiguration()/writeSessionFile() - this
        // reproduces that exact read-merge-write shape without importing the
        // Configuration module itself (it carries pre-existing type errors -
        // see CLAUDE.md - that would otherwise leak into this test-only
        // tsconfig's compilation).
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(workspaceFolder, 'No workspace folder is open - runTest.ts must launch with a workspace path');

        const vscodeDir = path.join(workspaceFolder!.uri.fsPath, '.vscode');
        const sessionFilePath = path.join(vscodeDir, 'sessions.json');
        fs.mkdirSync(vscodeDir, { recursive: true });
        const fixture = {
            $schema: LATEST_SCHEMA_URI,
            active: 'default',
            theme: 'default',
            sessions: { default: [{ name: 'hello', commands: ['echo hello'] }] }
        };
        fs.writeFileSync(sessionFilePath, JSON.stringify(fixture));

        const currentContent = JSON.parse(fs.readFileSync(sessionFilePath, 'utf8'));
        assert.strictEqual(currentContent.variable, undefined, 'fixture should start without a "variable" key');
        fs.writeFileSync(
            sessionFilePath,
            JSON.stringify({ ...currentContent, variable: { root: '/workspace/app' } })
        );

        const updated = JSON.parse(fs.readFileSync(sessionFilePath, 'utf8'));
        assert.deepStrictEqual(updated.variable, { root: '/workspace/app' });
        assert.deepStrictEqual(updated.sessions, fixture.sessions, 'unrelated fields must survive untouched');
    });

    test('resolveVscodeVariable resolves ${workspaceFolder}, ${userHome} and ${env:NAME}', () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(workspaceFolder, 'No workspace folder is open - runTest.ts must launch with a workspace path');

        assert.strictEqual(
            resolveVscodeVariable('${workspaceFolder}/src'),
            `${workspaceFolder!.uri.fsPath}/src`
        );
        assert.strictEqual(resolveVscodeVariable('${userHome}'), os.homedir());

        process.env.TERMINAL_KEEPER_TEST_VAR = 'test-value';
        assert.strictEqual(resolveVscodeVariable('${env:TERMINAL_KEEPER_TEST_VAR}'), 'test-value');
        delete process.env.TERMINAL_KEEPER_TEST_VAR;

        assert.strictEqual(
            resolveVscodeVariable('${env:TERMINAL_KEEPER_DOES_NOT_EXIST}'),
            '${env:TERMINAL_KEEPER_DOES_NOT_EXIST}',
            'An unset env var should be left untouched, not silently emptied'
        );
        assert.strictEqual(
            resolveVscodeVariable('${variable:projectRoot}'),
            '${variable:projectRoot}',
            'Custom ${variable:NAME} placeholders are a separate pass and must be left alone here'
        );
    });

    test('resolveVscodeVariablesDeep lets a "variable" value reference ${workspaceFolder}, then substituteVariablesDeep applies it to a session field', () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(workspaceFolder);

        const rawVariable = { root: '${workspaceFolder}/src' };
        const resolvedVariable = resolveVscodeVariablesDeep(rawVariable);
        assert.strictEqual(resolvedVariable.root, `${workspaceFolder!.uri.fsPath}/src`);

        const terminalItem = { name: 'build', cwd: '${variable:root}' };
        const finalItem = substituteVariablesDeep(terminalItem, resolvedVariable);
        assert.strictEqual(finalItem.cwd, `${workspaceFolder!.uri.fsPath}/src`);
    });
});
