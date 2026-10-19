import * as terminalBrowserify from '@vscode-utility/terminal-browserify';
import { Configuration } from '../configuration/configuration';
import { configFileVersions, SessionConfiguration, TerminalThemeName } from '../configuration/interface';
import { schemaUri } from '../configuration/schemaProvider';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail } from '../utils/utils';

// Migrates the given scope's sessions file, or every scope's when called
// without one (e.g. from the command palette).
export var migrateAsync = async (target?) => {
  const configurations = target?.scopeId ? [Configuration.get(target.scopeId)].filter(Boolean) : Configuration.all();
  for (const configuration of configurations) {
    await migrateScopeAsync(configuration);
  }
};
var migrateScopeAsync = async (configuration: Configuration) => {
  try {
    const isDefinedSessionFile = await configuration.isDefinedSessionFile();
    if (!isDefinedSessionFile) {
      return;
    }
    const currentConfiguration = await configuration.load();
    if (!currentConfiguration) {
      return;
    }
    const { $schema = "", theme = "", sessions = {} } = currentConfiguration;
    const migrateConfiguration: Partial<SessionConfiguration> = {};
    const fromV1 = $schema.includes(configFileVersions.v1);
    const fromV2 = $schema.includes(configFileVersions.v2);
    const fromV3 = $schema.includes(configFileVersions.v3);
    if (fromV1 || fromV2) {
      const latestSessions = {};
      Object.entries(sessions).forEach(([sessionName, sessionValues]) => {
        latestSessions[sessionName] = sessionValues.map((s) => s.split) || [];
      });
      migrateConfiguration.sessions = latestSessions;
    }
    if (fromV1 || fromV2 || fromV3) {
      switch (theme) {
        case terminalBrowserify.TerminalTheme.manual:
          migrateConfiguration.theme = terminalBrowserify.TerminalTheme.default as TerminalThemeName;
          break;
        case terminalBrowserify.TerminalTheme.auto:
          migrateConfiguration.theme = terminalBrowserify.TerminalTheme.tribe as TerminalThemeName;
          break;
        default:
          migrateConfiguration.theme = terminalBrowserify.TerminalTheme.default as TerminalThemeName;
          break;
      }
    }
    // Always point at the bundled schema, regardless of what the old $schema
    // value was (e.g. the now-dead cdn.statically.io URL) - this is the only
    // schema this extension ships and can guarantee resolves.
    migrateConfiguration.$schema = schemaUri.toString();
    await configuration.save(migrateConfiguration);
  } catch (error) {
    showErrorMessageWithDetail(constants.migrateConfigurationFailed, error);
  }
};
