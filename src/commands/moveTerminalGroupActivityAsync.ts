import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { swapAdjacent } from '../utils/reorder';
import { showErrorMessageWithDetail } from '../utils/utils';

export var moveTerminalGroupActivityAsync = async (terminalArrayTreeItem, direction) => {
  try {
    const { sessionId, terminalArrayIndex } = terminalArrayTreeItem || {};
    if (!sessionId || terminalArrayIndex === undefined) {
      return;
    }
    const configuration = await Configuration.resolve(terminalArrayTreeItem);
    if (!configuration) {
      return;
    }
    const config = await configuration.load();
    if (!config?.sessions) {
      return;
    }
    const { sessions } = config;
    const session = sessions[sessionId];
    if (!session?.[terminalArrayIndex] || !swapAdjacent(session, terminalArrayIndex, direction)) {
      return;
    }
    await configuration.save({ sessions });
  } catch (error) {
    showErrorMessageWithDetail(constants.moveTerminalGroupFailed, error);
  }
};
