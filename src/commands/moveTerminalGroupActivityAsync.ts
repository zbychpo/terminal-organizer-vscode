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
    const config = await Configuration.load();
    if (!config?.sessions) {
      return;
    }
    const { sessions } = config;
    const session = sessions[sessionId];
    if (!session?.[terminalArrayIndex] || !swapAdjacent(session, terminalArrayIndex, direction)) {
      return;
    }
    await Configuration.save({ sessions });
  } catch (error) {
    showErrorMessageWithDetail(constants.moveTerminalGroupFailed, error);
  }
};
