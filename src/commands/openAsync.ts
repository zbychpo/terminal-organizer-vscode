import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail, showTextDocument, showGenerateConfiguration } from '../utils/utils';

export var openAsync = async (target?) => {
  try {
    const configuration = await Configuration.resolve(target);
    if (!configuration) {
      return;
    }
    const isDefinedSessionFile = await configuration.isDefinedSessionFile();
    if (!isDefinedSessionFile) {
      await showGenerateConfiguration(configuration);
      return;
    }
    showTextDocument(configuration.sessionFilePath);
  } catch (error) {
    showErrorMessageWithDetail(constants.openConfigurationFailed, error);
  }
};
