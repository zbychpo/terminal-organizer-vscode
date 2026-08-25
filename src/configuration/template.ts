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
    default: [
      {
        name: "hello",
        autoExecuteCommands: true,
        icon: "person",
        color: "terminal.ansiGreen",
        commands: ["echo hello"]
      },
      [
        {
          name: "docker:ros",
          commands: [""]
        },
        {
          name: "docker:k8s",
          commands: [""]
        }
      ],
      [
        {
          name: "docker:nats",
          commands: [""]
        },
        {
          name: "docker:fleet",
          commands: [""]
        }
      ]
    ],
    "saved-session": [
      {
        name: "connect",
        commands: [""]
      }
    ]
  }
};
