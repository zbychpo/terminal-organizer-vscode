## 1.0.7

Added GUI editing for **Global Configs** items in the Activity Bar explorer: an inline edit button now opens a QuickPick/InputBox tailored to the setting's type — Yes/No for booleans, a theme picker for `theme`, a session picker for `active`, and a multi-select node picker (Global Configs, Variables, Environments, session names, split-terminal group names, environment names) for `openNodeOnStart` — and saves the value through the same settings.json/sessions.json resolution used elsewhere.

## 1.0.6

Added **Environments**: named sets of environment variables (`environments` in `sessions.json`, managed from the Activity Bar's new **Environments** section). The one marked active (`activeEnvironment`) is automatically merged into every terminal's `env` right before a session is activated — keys a terminal already defines in its own `env` win over the active environment's value, and any keys the terminal doesn't define are filled in from the environment. The Sessions tree's per-terminal preview now shows the resulting merged `env` that will actually be passed to the terminal.

## 1.0.4

Added `openNodeOnStart`, a config option (and matching `terminal-organizer-vscode.openNodeOnStart` workspace setting) that lists node names — "Sessions", "Variables", a session name, or a split-terminal group name — to expand by default in the Activity Bar explorer view.

## 1.0.3

Fixed a bug where the startup schema check matched the dead `cdn.statically.io` schema URL as "up to date" (both contained `/v11/`), so the config's `$schema` never got migrated to the bundled schema. The check now compares against the exact bundled schema URI.

## 1.0.2

Removed required "default" from schema

## 1.0.1

Fixed README.md

## 1.0.0

Initial version
