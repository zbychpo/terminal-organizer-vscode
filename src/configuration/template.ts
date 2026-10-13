import * as terminalBrowserify from '@vscode-utility/terminal-browserify';
import { schemaUri } from './schemaProvider';

export var configurationTemplate = {
  $schema: schemaUri.toString(),
  theme: terminalBrowserify.TerminalTheme.tribe,
  active: "default",
  activateOnStartup: true,
  keepExistingTerminals: false,
  variable: {},
  environments: {},
  activeEnvironment: "",
  sessions: {
    default: []
  }
};
