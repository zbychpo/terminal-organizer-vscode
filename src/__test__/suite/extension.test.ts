import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { substituteVariable, substituteVariablesDeep, resolveVariableReferences } from '../../utils/variable-substitution';
import { resolveVscodeVariable, resolveVscodeVariablesDeep } from '../../utils/vscode-variable-resolver';
import { applyEnvironmentToTerminals, resolveEnvironmentVariables, hasCircularInheritance, resolveMaskedVariableNames } from '../../utils/environment-merge';
import { swapAdjacent } from '../../utils/reorder';
import { mergeImportedTerminals } from '../../commands/importAsync';
import { buildCommands as buildTasksCommands } from '../../commands/modules/tasksParse';
import { applyTerminalFieldUpdate, describeField, validateJsonStringArray, validateJsonStringRecord } from '../../commands/editTerminalActivityAsync';
import { toggleMask } from '../../commands/toggleEnvironmentVariableMaskAsync';
import { configurationTemplate } from '../../configuration/template';
import { Configuration } from '../../configuration/configuration';
import { TreeProvider } from '../../explorer/tree-provider';
import { findEnvironmentSource, getLogChannel, logLaunch } from '../../utils/launch-log';
import { applyGlobalVariables, mergeScopeConfigurations, resolveRelativeCwdDeep } from '../../utils/scope-merge';

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

    test('Bundled schema defines "environments"/"environmentItem" and the top-level "activeEnvironment" property', async () => {
        const ext = vscode.extensions.getExtension(EXTENSION_ID);
        assert.ok(ext);
        await ext!.activate();

        const schemaUri = vscode.Uri.parse(LATEST_SCHEMA_URI);
        const doc = await vscode.workspace.openTextDocument(schemaUri);
        const schema = JSON.parse(doc.getText());

        assert.ok(schema.definitions?.environments, 'definitions.environments is missing');
        assert.ok(schema.definitions?.environmentItem, 'definitions.environmentItem is missing');
        assert.ok(
            schema.definitions?.environmentItem?.properties?.inherits,
            'definitions.environmentItem is missing the "inherits" property'
        );
        assert.ok(
            schema.definitions['terminal-organizer-vscode'].properties.activeEnvironment,
            'top-level "activeEnvironment" property is missing'
        );
        assert.strictEqual(
            schema.definitions['terminal-organizer-vscode'].properties.environments.$ref,
            '#/definitions/environments'
        );
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

    test('Environment commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('terminal-organizer-vscode.add-environment-activity'));
        assert.ok(commands.includes('terminal-organizer-vscode.remove-environment-activity'));
        assert.ok(commands.includes('terminal-organizer-vscode.set-active-environment-activity'));
        assert.ok(commands.includes('terminal-organizer-vscode.add-environment-variable-activity'));
        assert.ok(commands.includes('terminal-organizer-vscode.edit-environment-variable-activity'));
        assert.ok(commands.includes('terminal-organizer-vscode.remove-environment-variable-activity'));
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

    test('"environments" and "activeEnvironment" keys can be added to a sessions.json that never had them', async () => {
        // Same read-merge-write shape as addVariableAsync/etc. (see the test
        // above) - addEnvironmentAsync/setActiveEnvironmentAsync/etc. write
        // through Configuration.getSessionConfiguration()/writeSessionFile()
        // directly for the same reason: Configuration.save()/update() can
        // only patch keys that already exist in the file.
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
        assert.strictEqual(currentContent.environments, undefined, 'fixture should start without an "environments" key');
        assert.strictEqual(currentContent.activeEnvironment, undefined, 'fixture should start without an "activeEnvironment" key');
        fs.writeFileSync(
            sessionFilePath,
            JSON.stringify({
                ...currentContent,
                environments: { java11: { JAVA_HOME: 'C:\\java11', PATH: '${variable:javaHome}\\bin;${env:PATH}' } },
                activeEnvironment: 'java11'
            })
        );

        const updated = JSON.parse(fs.readFileSync(sessionFilePath, 'utf8'));
        assert.deepStrictEqual(updated.environments, {
            java11: { JAVA_HOME: 'C:\\java11', PATH: '${variable:javaHome}\\bin;${env:PATH}' }
        });
        assert.strictEqual(updated.activeEnvironment, 'java11');
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

    test('applyEnvironmentToTerminals fills in missing keys from the active environment but lets the terminal\'s own env win on conflicts', () => {
        const environmentVariables = {
            JAVA_HOME: 'C:\\java8',
            MAVEN_HOME: 'C:\\maven',
            PATH: '${variable:javaHome}\\bin;${env:PATH}'
        };
        const terminalItem = {
            name: 'build',
            commands: ['mvn install'],
            env: { JAVA_HOME: 'C:\\java11', ILE_ELEMENTO: '10' }
        };

        const merged = applyEnvironmentToTerminals(terminalItem, environmentVariables);

        assert.deepStrictEqual(merged.env, {
            JAVA_HOME: 'C:\\java11', // the terminal's own value wins over the environment's
            MAVEN_HOME: 'C:\\maven', // filled in from the environment - the terminal didn't define it
            PATH: '${variable:javaHome}\\bin;${env:PATH}', // filled in from the environment
            ILE_ELEMENTO: '10' // terminal-only key, untouched
        });
        // The original object must not be mutated - callers still hold a
        // reference to the raw session data loaded from sessions.json.
        assert.deepStrictEqual(terminalItem.env, { JAVA_HOME: 'C:\\java11', ILE_ELEMENTO: '10' });
    });

    test('applyEnvironmentToTerminals adds the whole environment when a terminal defines no env at all', () => {
        const environmentVariables = { JAVA_HOME: 'C:\\java8' };
        const terminalItem = { name: 'build', commands: ['mvn install'] };

        const merged = applyEnvironmentToTerminals(terminalItem, environmentVariables);

        assert.deepStrictEqual(merged.env, { JAVA_HOME: 'C:\\java8' });
    });

    test('applyEnvironmentToTerminals is a no-op when there is no active environment', () => {
        const terminalItem = { name: 'build', env: { FOO: 'bar' } };
        assert.strictEqual(applyEnvironmentToTerminals(terminalItem, undefined), terminalItem);
        assert.strictEqual(applyEnvironmentToTerminals(terminalItem, {}), terminalItem);
    });

    test('applyEnvironmentToTerminals recurses into standalone terminals and split-terminal groups alike', () => {
        const environmentVariables = { JAVA_HOME: 'C:\\java8' };
        const session = [
            { name: 'standalone', commands: [''] },
            [
                { name: 'left', commands: [''], env: { JAVA_HOME: 'C:\\java11' } },
                { name: 'right', commands: [''] }
            ]
        ];

        const merged = applyEnvironmentToTerminals(session, environmentVariables);

        assert.deepStrictEqual(merged[0].env, { JAVA_HOME: 'C:\\java8' });
        assert.deepStrictEqual(merged[1][0].env, { JAVA_HOME: 'C:\\java11' }, 'the split terminal\'s own env must still win');
        assert.deepStrictEqual(merged[1][1].env, { JAVA_HOME: 'C:\\java8' });
    });

    test('An active environment merged into a terminal has its ${variable:NAME} and ${env:NAME} placeholders resolved by the same pipeline as session fields', () => {
        const variable = { javaHome: 'C:\\Program Files\\Java\\jdk-17' };
        process.env.TERMINAL_KEEPER_TEST_PATH = 'C:\\Windows\\System32';
        try {
            const environmentVariables = {
                JAVA_HOME: '${variable:javaHome}',
                PATH: '${variable:javaHome}\\bin;${env:TERMINAL_KEEPER_TEST_PATH}'
            };
            const terminalItem = { name: 'build', commands: ['mvn install'] };

            const merged = applyEnvironmentToTerminals(terminalItem, environmentVariables);
            const resolved = substituteVariablesDeep(resolveVscodeVariablesDeep(merged), resolveVscodeVariablesDeep(variable));

            assert.strictEqual(resolved.env.JAVA_HOME, 'C:\\Program Files\\Java\\jdk-17');
            assert.strictEqual(resolved.env.PATH, 'C:\\Program Files\\Java\\jdk-17\\bin;C:\\Windows\\System32');
        } finally {
            delete process.env.TERMINAL_KEEPER_TEST_PATH;
        }
    });

    test('resolveEnvironmentVariables merges an "inherits" chain with later entries winning, then lets the environment\'s own variables win over all of them', () => {
        const environments = {
            base: { PATH: 'base-path', ONLY_BASE: '1' },
            logging: { LOG_LEVEL: 'info' },
            verboseLogging: { LOG_LEVEL: 'debug' },
            java17: {
                inherits: ['base', 'logging', 'verboseLogging'],
                JAVA_HOME: 'C:\\java17'
            }
        };

        const resolved = resolveEnvironmentVariables(environments, 'java17');

        assert.deepStrictEqual(resolved, {
            PATH: 'base-path',
            ONLY_BASE: '1',
            LOG_LEVEL: 'debug', // verboseLogging is later in the list than logging, so it wins
            JAVA_HOME: 'C:\\java17'
        });
    });

    test('resolveEnvironmentVariables lets an environment\'s own variables override anything inherited, even for keys also set by a parent', () => {
        const environments = {
            base: { JAVA_HOME: 'C:\\java8', PATH: 'base-path' },
            java17: { inherits: ['base'], JAVA_HOME: 'C:\\java17' }
        };

        const resolved = resolveEnvironmentVariables(environments, 'java17');

        assert.deepStrictEqual(resolved, { JAVA_HOME: 'C:\\java17', PATH: 'base-path' });
    });

    test('resolveEnvironmentVariables resolves a multi-level inheritance chain recursively', () => {
        const environments = {
            base: { A: 'base' },
            mid: { inherits: ['base'], B: 'mid' },
            top: { inherits: ['mid'], C: 'top' }
        };

        assert.deepStrictEqual(resolveEnvironmentVariables(environments, 'top'), { A: 'base', B: 'mid', C: 'top' });
    });

    test('resolveEnvironmentVariables is cycle-safe and does not hang or throw on a circular "inherits" chain', () => {
        const environments = {
            a: { inherits: ['b'], A: '1' },
            b: { inherits: ['a'], B: '2' }
        };

        assert.deepStrictEqual(resolveEnvironmentVariables(environments, 'a'), { A: '1', B: '2' });
    });

    test('resolveEnvironmentVariables returns an empty object for a missing or empty environment name', () => {
        assert.deepStrictEqual(resolveEnvironmentVariables({ base: { A: '1' } }, ''), {});
        assert.deepStrictEqual(resolveEnvironmentVariables({ base: { A: '1' } }, 'doesNotExist'), {});
        assert.deepStrictEqual(resolveEnvironmentVariables(undefined, 'base'), {});
    });

    test('hasCircularInheritance detects direct and indirect cycles but not diamond-shaped inheritance', () => {
        assert.strictEqual(
            hasCircularInheritance({ a: { inherits: ['a'] } }, 'a'),
            true,
            'an environment listing itself is a direct cycle'
        );
        assert.strictEqual(
            hasCircularInheritance({ a: { inherits: ['b'] }, b: { inherits: ['a'] } }, 'a'),
            true,
            'two environments inheriting from each other is an indirect cycle'
        );
        assert.strictEqual(
            hasCircularInheritance(
                { base: {}, a: { inherits: ['base'] }, b: { inherits: ['base'] }, top: { inherits: ['a', 'b'] } },
                'top'
            ),
            false,
            'a diamond (top -> a,b -> base) is not a cycle even though "base" is reached twice'
        );
    });

    test('resolveMaskedVariableNames returns an environment\'s own "mask" list and unions it with masks inherited through "inherits"', () => {
        const environments = {
            base: { API_KEY: 'secret', mask: ['API_KEY'] },
            java17: { inherits: ['base'], JAVA_HOME: 'C:\\java17', TOKEN: 'secret2', mask: ['TOKEN'] }
        };

        const resolved = resolveMaskedVariableNames(environments, 'java17');

        assert.strictEqual(resolved.has('API_KEY'), true, 'mask inherited from "base" should still apply');
        assert.strictEqual(resolved.has('TOKEN'), true, 'the environment\'s own "mask" entry should apply');
        assert.strictEqual(resolved.has('JAVA_HOME'), false);
    });

    test('resolveMaskedVariableNames is cycle-safe and returns an empty set for a missing environment', () => {
        const environments = {
            a: { inherits: ['b'], mask: ['A'] },
            b: { inherits: ['a'], mask: ['B'] }
        };

        const resolved = resolveMaskedVariableNames(environments, 'a');
        assert.strictEqual(resolved.has('A'), true);
        assert.strictEqual(resolved.has('B'), true);
        assert.deepStrictEqual(resolveMaskedVariableNames(environments, 'doesNotExist'), new Set());
        assert.deepStrictEqual(resolveMaskedVariableNames(undefined, 'a'), new Set());
    });

    test('swapAdjacent swaps an item with its previous/next neighbor and reports whether anything changed', () => {
        const upward = ['a', 'b', 'c'];
        assert.strictEqual(swapAdjacent(upward, 1, -1), true);
        assert.deepStrictEqual(upward, ['b', 'a', 'c']);

        const downward = ['a', 'b', 'c'];
        assert.strictEqual(swapAdjacent(downward, 1, 1), true);
        assert.deepStrictEqual(downward, ['a', 'c', 'b']);
    });

    test('swapAdjacent is a no-op at the boundaries of the array', () => {
        const atStart = ['a', 'b', 'c'];
        assert.strictEqual(swapAdjacent(atStart, 0, -1), false);
        assert.deepStrictEqual(atStart, ['a', 'b', 'c']);

        const atEnd = ['a', 'b', 'c'];
        assert.strictEqual(swapAdjacent(atEnd, 2, 1), false);
        assert.deepStrictEqual(atEnd, ['a', 'b', 'c']);

        assert.strictEqual(swapAdjacent(['solo'], 0, -1), false);
        assert.strictEqual(swapAdjacent(undefined, 0, -1), false);
    });

    test('mergeImportedTerminals replaces an existing standalone terminal by name and appends genuinely new ones', () => {
        const previousItems = [
            { name: 'build', commands: ['old build command'] },
            { name: 'test', commands: ['old test command'] }
        ];
        const importedItems = [
            { name: 'build', commands: ['new build command'], cwd: '/repo' },
            { name: 'lint', commands: ['npm run lint'] }
        ];

        const merged = mergeImportedTerminals(previousItems, importedItems);

        assert.deepStrictEqual(merged, [
            { name: 'build', commands: ['new build command'], cwd: '/repo' },
            { name: 'test', commands: ['old test command'] },
            { name: 'lint', commands: ['npm run lint'] }
        ]);
    });

    test('mergeImportedTerminals replaces a terminal inside a split-terminal group in place, keeping it in the group', () => {
        const previousItems = [
            [
                { name: 'server', commands: ['old server command'] },
                { name: 'client', commands: ['old client command'] }
            ]
        ];
        const importedItems = [{ name: 'server', commands: ['new server command'] }];

        const merged = mergeImportedTerminals(previousItems, importedItems);

        assert.deepStrictEqual(merged, [
            [
                { name: 'server', commands: ['new server command'] },
                { name: 'client', commands: ['old client command'] }
            ]
        ]);
    });

    test('buildCommands (tasks.json) extracts shell tasks, tolerates comments, and synthesizes "npm run <script>" for npm-type tasks', () => {
        const contents = `{
            // a comment that should be ignored
            "version": "2.0.0",
            "tasks": [
                { "label": "build", "type": "shell", "command": "echo", "args": ["building"] },
                { "label": "build-script", "type": "npm", "script": "build" },
                { "type": "shell", "command": "echo no-label" }
            ],
        }`;

        const scripts = buildTasksCommands(contents);

        assert.deepStrictEqual(scripts, {
            build: ['echo building'],
            'build-script': ['npm run build']
        });
    });

    test('applyTerminalFieldUpdate sets a field, and clears it (deletes the key) when given an empty/undefined value', () => {
        const terminal = { name: 'build', commands: ['npm run build'], color: 'terminal.ansiGreen' };

        const withNewColor = applyTerminalFieldUpdate(terminal, 'color', 'terminal.ansiRed');
        assert.strictEqual(withNewColor.color, 'terminal.ansiRed');
        assert.strictEqual(terminal.color, 'terminal.ansiGreen', 'the original terminal object must not be mutated');

        const withClearedColor = applyTerminalFieldUpdate(terminal, 'color', undefined);
        assert.strictEqual('color' in withClearedColor, false);

        const withClearedIcon = applyTerminalFieldUpdate(terminal, 'icon', '');
        assert.strictEqual('icon' in withClearedIcon, false);
    });

    test('describeField renders a human-readable preview for each terminal field type', () => {
        const terminal = {
            name: 'build',
            commands: ['npm install', 'npm run build'],
            disabled: true,
            autoExecuteCommands: false,
            env: { NODE_ENV: 'production' },
            color: 'terminal.ansiGreen'
        };

        assert.strictEqual(describeField(terminal, 'commands'), 'npm install | npm run build');
        assert.strictEqual(describeField(terminal, 'shellArgs'), '(none)', 'an unset array field falls back to "(none)"');
        assert.strictEqual(describeField(terminal, 'disabled'), 'Yes');
        assert.strictEqual(describeField(terminal, 'autoExecuteCommands'), 'No');
        assert.strictEqual(describeField(terminal, 'env'), '{"NODE_ENV":"production"}');
        assert.strictEqual(describeField(terminal, 'icon'), '(theme default)', 'an unset color/icon falls back to "(theme default)"');
        assert.strictEqual(describeField(terminal, 'cwd'), '(not set)', 'any other unset field falls back to "(not set)"');
    });

    test('validateJsonStringArray accepts a JSON array of strings and rejects anything else', () => {
        assert.strictEqual(validateJsonStringArray('["a", "b"]'), '');
        assert.strictEqual(validateJsonStringArray('[]'), '');
        assert.notStrictEqual(validateJsonStringArray('not json'), '');
        assert.notStrictEqual(validateJsonStringArray('{"a": "b"}'), '', 'an object is not an array');
        assert.notStrictEqual(validateJsonStringArray('[1, 2]'), '', 'array items must be strings');
    });

    test('validateJsonStringRecord accepts a JSON object of string values and rejects anything else', () => {
        assert.strictEqual(validateJsonStringRecord('{"NAME": "value"}'), '');
        assert.strictEqual(validateJsonStringRecord('{}'), '');
        assert.notStrictEqual(validateJsonStringRecord('not json'), '');
        assert.notStrictEqual(validateJsonStringRecord('["a", "b"]'), '', 'an array is not an object');
        assert.notStrictEqual(validateJsonStringRecord('{"NAME": 1}'), '', 'object values must be strings');
        assert.notStrictEqual(validateJsonStringRecord('null'), '', 'null is not an object');
    });

    test('toggleMask adds a variable name to the mask list, and removes it again on a second toggle', () => {
        const afterFirstToggle = toggleMask(undefined, 'API_KEY');
        assert.deepStrictEqual(afterFirstToggle, ['API_KEY']);

        const afterSecondToggle = toggleMask(afterFirstToggle, 'API_KEY');
        assert.deepStrictEqual(afterSecondToggle, []);

        assert.deepStrictEqual(toggleMask(['API_KEY'], 'TOKEN'), ['API_KEY', 'TOKEN']);
    });

    test('Bundled schema defines "mask" on environmentItem', async () => {
        const ext = vscode.extensions.getExtension(EXTENSION_ID);
        assert.ok(ext);
        await ext!.activate();

        const schemaUri = vscode.Uri.parse(LATEST_SCHEMA_URI);
        const doc = await vscode.workspace.openTextDocument(schemaUri);
        const schema = JSON.parse(doc.getText());

        assert.ok(schema.definitions?.environmentItem?.properties?.mask, 'definitions.environmentItem is missing the "mask" property');
    });

    test('The generated configuration template starts with a single empty "default" session', () => {
        assert.deepStrictEqual(configurationTemplate.sessions, { default: [] });
    });

    test('Multi-root settings are contributed with sensible defaults', () => {
        const ext = vscode.extensions.getExtension(EXTENSION_ID);
        assert.ok(ext);
        const properties = ext!.packageJSON.contributes.configuration.properties;
        assert.deepStrictEqual(properties['terminal-organizer-vscode.sessionFileLocations'].default, ['.vscode/sessions.json', 'sessions.json']);
        assert.strictEqual(properties['terminal-organizer-vscode.multiRootMode'].default, 'separate');
        assert.strictEqual(properties['terminal-organizer-vscode.theme'].scope, 'resource');
    });

    test('mergeScopeConfigurations merges variable/environments with the folder winning, and fills only unset options', () => {
        const base = {
            theme: 'neon',
            noClear: true,
            joinOperator: '&&',
            activeEnvironment: 'dev',
            variable: { javaHome: '/opt/java', prj: '/ws' },
            environments: { dev: { A: '1' }, prod: { A: '2' } },
            sessions: { shared: [{ name: 'ws' }] }
        };
        const own = {
            theme: 'tribe',
            joinOperator: '',
            variable: { prj: '/ws/backend' },
            environments: { dev: { B: '3' } },
            sessions: { default: [{ name: 'api' }] }
        };
        const merged = mergeScopeConfigurations(base, own);
        assert.strictEqual(merged.theme, 'tribe');
        assert.strictEqual(merged.noClear, true);
        assert.strictEqual(merged.joinOperator, '&&');
        assert.strictEqual(merged.activeEnvironment, 'dev');
        assert.deepStrictEqual(merged.variable, { javaHome: '/opt/java', prj: '/ws/backend' });
        assert.deepStrictEqual(merged.environments, { dev: { B: '3' }, prod: { A: '2' } });
        assert.deepStrictEqual(merged.sessions, { default: [{ name: 'api' }] }, 'sessions must never be merged across scopes');
        assert.deepStrictEqual(own.variable, { prj: '/ws/backend' }, 'the folder configuration must not be mutated');
    });

    test('mergeScopeConfigurations is a no-op without a base configuration', () => {
        const own = { theme: 'tribe', sessions: { default: [] } };
        assert.deepStrictEqual(mergeScopeConfigurations(undefined, own), own);
    });

    test('resolveRelativeCwdDeep makes relative cwds absolute against the scope folder, in standalone and split terminals', () => {
        const folder = path.join(os.tmpdir(), 'backend');
        const absolute = path.join(os.tmpdir(), 'elsewhere');
        const session: any[] = [
            { name: 'a', cwd: 'src' },
            [{ name: 'b', cwd: absolute }, { name: 'c' }]
        ];
        const resolved = resolveRelativeCwdDeep(session, folder);
        assert.strictEqual(resolved[0].cwd, path.join(folder, 'src'));
        assert.strictEqual(resolved[1][0].cwd, absolute);
        assert.strictEqual(resolved[1][1].cwd, undefined, 'a missing cwd is left alone unless fillMissing is set');
        assert.strictEqual((session[0] as any).cwd, 'src', 'the input must not be mutated');

        const filled = resolveRelativeCwdDeep(session, folder, true);
        assert.strictEqual(filled[1][1].cwd, folder);
    });

    test('resolveVscodeVariable resolves a bare ${workspaceFolder} to the given scope folder', () => {
        const folder = path.join(os.tmpdir(), 'frontend');
        assert.strictEqual(resolveVscodeVariable('${workspaceFolder}/src', folder), `${folder}/src`);
        assert.strictEqual(resolveVscodeVariable('${workspaceFolderBasename}', folder), 'frontend');
    });

    test('applyGlobalVariables puts global variables under a project\'s own ones without touching anything else', () => {
        const own = { theme: 'tribe', variable: { prj: '/own' }, sessions: { default: [] } };
        const merged = applyGlobalVariables(own, { javaHome: '/opt/java', prj: '/global' });
        assert.deepStrictEqual(merged.variable, { javaHome: '/opt/java', prj: '/own' });
        assert.strictEqual(merged.theme, 'tribe');
        assert.deepStrictEqual(own.variable, { prj: '/own' }, 'the configuration must not be mutated');
        assert.deepStrictEqual(applyGlobalVariables({ sessions: {} }, { a: '1' }).variable, { a: '1' });
        assert.strictEqual(applyGlobalVariables(own, {}), own);
    });

    test('globalVariables is contributed as an application-scoped (user-only) setting', () => {
        const ext = vscode.extensions.getExtension(EXTENSION_ID);
        const setting = ext!.packageJSON.contributes.configuration.properties['terminal-organizer-vscode.globalVariables'];
        assert.ok(setting, 'globalVariables setting is missing');
        assert.strictEqual(setting.scope, 'application');
        assert.deepStrictEqual(setting.default, {});
    });

    test('resolveVariableReferences resolves variables that reference other variables, to any depth', () => {
        const resolved = resolveVariableReferences({
            javaBin: '${variable:javaHome}/bin',
            javaHome: '${variable:tools}/jdk',
            tools: 'C:/tools',
            plain: 'x'
        });
        assert.deepStrictEqual(resolved, { javaBin: 'C:/tools/jdk/bin', javaHome: 'C:/tools/jdk', tools: 'C:/tools', plain: 'x' });
    });

    test('resolveVariableReferences leaves cyclic and unknown references as-is instead of looping', () => {
        const resolved = resolveVariableReferences({ a: '${variable:b}!', b: '${variable:a}?', c: '${variable:missing}', self: '${variable:self}' });
        assert.strictEqual(resolved.c, '${variable:missing}');
        assert.strictEqual(resolved.self, '${variable:self}');
        assert.ok(resolved.a.includes('${variable:'), 'a cycle keeps a literal reference');
        assert.ok(resolved.b.includes('${variable:'), 'a cycle keeps a literal reference');
    });

    test('substituteVariablesDeep applies nested variable references to session fields', () => {
        const session = [{ name: 'build', cwd: '${variable:javaBin}', commands: ['${variable:javaBin}/java -version'] }];
        const result = substituteVariablesDeep(session, { javaHome: '/opt/jdk', javaBin: '${variable:javaHome}/bin' });
        assert.strictEqual(result[0].cwd, '/opt/jdk/bin');
        assert.deepStrictEqual(result[0].commands, ['/opt/jdk/bin/java -version']);
    });

    test('globalVariables can be written to and read back from the user settings', async () => {
        const ext = vscode.extensions.getExtension(EXTENSION_ID);
        await ext!.activate();
        const config = () => vscode.workspace.getConfiguration('terminal-organizer-vscode');
        const previous = config().inspect('globalVariables')?.globalValue;
        try {
            await config().update('globalVariables', { testVar: 'C:/test' }, vscode.ConfigurationTarget.Global);
            assert.deepStrictEqual(config().inspect('globalVariables')?.globalValue, { testVar: 'C:/test' });
        } finally {
            await config().update('globalVariables', previous, vscode.ConfigurationTarget.Global);
        }
    });

    test('A global variable is listed only in "Global Variables", not in the project "Variables" group (also after the project variable is removed)', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders![0];
        const sessionFilePath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'sessions.json');
        const original = fs.existsSync(sessionFilePath) ? fs.readFileSync(sessionFilePath, 'utf8') : undefined;
        const config = () => vscode.workspace.getConfiguration('terminal-organizer-vscode');
        const previousGlobals = config().inspect('globalVariables')?.globalValue;
        const labelsOf = (items: any[] | undefined) => (items || []).map((i) => `${i.label}`);
        try {
            fs.mkdirSync(path.dirname(sessionFilePath), { recursive: true });
            fs.writeFileSync(sessionFilePath, JSON.stringify({ sessions: { default: [] }, variable: { javaHome21: 'C:/own', other: 'x' } }));
            await config().update('globalVariables', { javaHome21: 'C:/global' }, vscode.ConfigurationTarget.Global);
            await Configuration.initialize();
            const provider = new TreeProvider();

            let top = await provider.getChildren(undefined);
            let variables = top.find((i: any) => i.label === 'Variables');
            assert.deepStrictEqual(labelsOf(variables?.children).sort(), ['javaHome21', 'other']);

            // Remove the project's own javaHome21 - the global one must not take its place in the project group.
            fs.writeFileSync(sessionFilePath, JSON.stringify({ sessions: { default: [] }, variable: { other: 'x' } }));
            top = await provider.getChildren(undefined);
            variables = top.find((i: any) => i.label === 'Variables');
            assert.deepStrictEqual(labelsOf(variables?.children), ['other']);
            const globals = top.find((i: any) => i.label === 'Global Variables');
            assert.deepStrictEqual(labelsOf(globals?.children), ['javaHome21']);
        } finally {
            await config().update('globalVariables', previousGlobals, vscode.ConfigurationTarget.Global);
            if (original === undefined) {
                fs.rmSync(sessionFilePath, { force: true });
            } else {
                fs.writeFileSync(sessionFilePath, original);
            }
        }
    });

    test('findEnvironmentSource follows the same precedence as resolveEnvironmentVariables', () => {
        const environments = {
            base: { A: 'base', B: 'base' },
            extra: { B: 'extra', C: 'extra' },
            dev: { inherits: ['base', 'extra'], C: 'dev' }
        };
        assert.strictEqual(findEnvironmentSource(environments, 'dev', 'A'), 'base');
        assert.strictEqual(findEnvironmentSource(environments, 'dev', 'B'), 'extra', 'a later "inherits" entry wins');
        assert.strictEqual(findEnvironmentSource(environments, 'dev', 'C'), 'dev', 'own keys win');
        assert.strictEqual(findEnvironmentSource(environments, 'dev', 'missing'), undefined);
        assert.strictEqual(findEnvironmentSource({ a: { inherits: ['b'] }, b: { inherits: ['a'] } }, 'a', 'X'), undefined, 'cycle-safe');
    });

    test('logLaunch writes launch parameters with their sources when logLaunches is on, and keeps masked values masked', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders![0];
        const sessionFilePath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'sessions.json');
        const original = fs.existsSync(sessionFilePath) ? fs.readFileSync(sessionFilePath, 'utf8') : undefined;
        const config = () => vscode.workspace.getConfiguration('terminal-organizer-vscode');
        const previousLog = config().inspect('logLaunches')?.globalValue;
        const previousGlobals = config().inspect('globalVariables')?.globalValue;
        const channel = getLogChannel() as any;
        const lines: string[] = [];
        const saved = { appendLine: channel.appendLine, info: channel.info, warn: channel.warn };
        channel.appendLine = (line: string) => lines.push(line);
        channel.info = (line: string) => lines.push(`INFO ${line}`);
        channel.warn = (line: string) => lines.push(`WARN ${line}`);
        try {
            fs.mkdirSync(path.dirname(sessionFilePath), { recursive: true });
            const terminal = { name: 'api', cwd: '${variable:root}', commands: ['run ${variable:tool} ${variable:typo}'], env: { PORT: '3000' } };
            fs.writeFileSync(sessionFilePath, JSON.stringify({
                theme: 'neon',
                activeEnvironment: 'dev',
                variable: { root: workspaceFolder.uri.fsPath, secret: 's3cr3t' },
                environments: { base: { TOKEN: '${variable:secret}', mask: ['TOKEN'] }, dev: { inherits: ['base'], MODE: 'dev' } },
                sessions: { default: [terminal] }
            }));
            await config().update('globalVariables', { tool: 'C:/tools/x' }, vscode.ConfigurationTarget.Global);
            await config().update('logLaunches', true, vscode.ConfigurationTarget.Global);
            await Configuration.initialize();
            const configuration = Configuration.all()[0];
            const effectiveConfig = await configuration.loadEffective();
            const resolved = {
                name: 'api',
                cwd: workspaceFolder.uri.fsPath,
                cwdPath: workspaceFolder.uri.fsPath,
                commands: ['run C:/tools/x ${variable:typo}'],
                env: { TOKEN: 's3cr3t', MODE: 'dev', PORT: '3000' }
            };
            await logLaunch({ configuration, title: 'session "default"', effectiveConfig, rawTerminals: [terminal], resolvedTerminals: [resolved] });
            const text = lines.join('\n');
            assert.ok(text.includes('INFO Launching session "default"'), text);
            assert.ok(/theme=neon \(project/.test(text), 'theme source should be the project sessions.json');
            assert.ok(/tool = C:\/tools\/x\s+← global variables/.test(text), 'global variable source');
            assert.ok(/root = .*← project/.test(text), 'project variable source');
            assert.ok(/typo\s+← NOT DEFINED/.test(text), 'undefined variable is reported');
            assert.ok(/MODE = dev\s+← environment "dev"/.test(text), 'own environment key');
            assert.ok(/TOKEN = ••••••••\s+← environment "base" \(via dev\)/.test(text), 'inherited masked key');
            assert.ok(/PORT = 3000\s+← terminal's own env/.test(text), 'terminal env key');
            assert.ok(!text.includes('s3cr3t'), 'masked values (and the variables feeding them) must not leak into the log');
            assert.ok(text.includes('WARN terminal "api": unresolved placeholders ${variable:typo}'), 'unresolved placeholder warning');

            lines.length = 0;
            await config().update('logLaunches', false, vscode.ConfigurationTarget.Global);
            await logLaunch({ configuration, title: 'session "default"', effectiveConfig, rawTerminals: [terminal], resolvedTerminals: [resolved] });
            assert.strictEqual(lines.length, 0, 'nothing is logged when logLaunches is off');
        } finally {
            Object.assign(channel, saved);
            await config().update('logLaunches', previousLog, vscode.ConfigurationTarget.Global);
            await config().update('globalVariables', previousGlobals, vscode.ConfigurationTarget.Global);
            if (original === undefined) {
                fs.rmSync(sessionFilePath, { force: true });
            } else {
                fs.writeFileSync(sessionFilePath, original);
            }
        }
    });
});
