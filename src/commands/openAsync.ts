import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { showErrorMessageWithDetail, showTextDocument, showGenerateConfiguration } from '../utils/utils';

export var openAsync = async () => {
  try {
    const isDefinedSessionFile = await Configuration.isDefinedSessionFile();
    if (!isDefinedSessionFile) {
      await showGenerateConfiguration();
      return;
    }
    showTextDocument(Configuration.sessionFilePath);
  } catch (error) {
    showErrorMessageWithDetail(constants.openConfigurationFailed, error);
  }
};
