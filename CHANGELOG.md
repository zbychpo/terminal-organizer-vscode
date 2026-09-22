## 1.0.14

Added an inline **Duplicate Terminal** (copy) button to a single terminal in the Activity Bar's **Sessions** tree: it prompts for a name (pre-filled with a unique "name (copy)" suggestion, validated against every terminal name already used in any session) and inserts a full copy of that terminal right after the original - staying inside the same split-terminal group if the original was part of one.

## 1.0.13

Added inheritance for **Environments**: an environment can now set `inherits` to a list of other environment names, resolved before its own variables - environments later in the list override values from earlier ones, and the environment's own variables always win over anything inherited. A new inline **Edit Inheritance** button on each environment opens a checklist of the other available environments (pre-checked with the current value, current environment excluded) to add or clear from its inheritance, rejecting any selection that would create a circular chain. Hovering over an environment in the Activity Bar now shows its fully resolved variables (after inheritance is applied, with inherited-only values marked), matching how a terminal's tooltip already shows its fully resolved commands and `env`.

## 1.0.12

Added an inline **Duplicate** (copy) button to both sessions and environments in the Activity Bar explorer: it prompts for a name (pre-filled with a unique "name (copy)" suggestion, validated against existing names) and creates a full copy of the session's terminals/split-terminal groups or the environment's variables under that name.

## 1.0.11

Added a top-level `joinOperator` config (and matching `terminal-organizer-vscode.joinOperator` workspace setting), editable from the Activity Bar's **Global Configs** group, that sets the default operator used to join a terminal's multiple commands. A terminal's own `joinOperator` still overrides this global value, and if neither is set the previous OS-based default (`&` on Windows, `;` elsewhere) is used. The Sessions tree's per-terminal preview reflects the resolved operator too.

## 1.0.10

Added inline **Remove Terminal** and **Remove Terminal Group** buttons in the Activity Bar's **Sessions** tree: a single terminal node now has its own trash button that removes just that terminal (including one inside a split-terminal group, without disturbing the rest of the group), and a split-terminal group node has a trash button that removes the whole group in one click.

## 1.0.9

Added an inline **Remove Session** button (next to the existing Active Session button) to each session in the Activity Bar's **Sessions** group, so a whole session can be deleted with one click instead of going through the command palette's session picker. The default session is still protected from removal.

## 1.0.8

Added an **import** button to the Activity Bar's **Variables** group that reads a `.env`-style file (comments, `export` prefixes, and quoted values are handled) and adds every `KEY=value` line as a variable. After importing, you can optionally name an environment to add alongside it - one with the same keys, each pointing back at the imported variable via `${variable:NAME}` instead of duplicating the raw value.

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
