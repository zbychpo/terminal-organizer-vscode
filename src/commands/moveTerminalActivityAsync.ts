import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { swapAdjacent } from '../utils/reorder';
import { showErrorMessageWithDetail } from '../utils/utils';

export var moveTerminalActivityAsync = async (terminalTreeItem, direction) => {
  try {
    const { sessionId, terminalArrayIndex, label } = terminalTreeItem || {};
    if (!sessionId || terminalArrayIndex === undefined) {
      return;
    }
    const configuration = await Configuration.resolve(terminalTreeItem);
    if (!configuration) {
      return;
    }
    const config = await configuration.load();
    if (!config?.sessions) {
      return;
    }
    const { sessions } = config;
    const session = sessions[sessionId];
    const sessionItem = session?.[terminalArrayIndex];
    if (!sessionItem) {
      return;
    }
    if (Array.isArray(sessionItem)) {
      const index = sessionItem.findIndex((t) => t.name === label);
      if (index === -1 || !swapAdjacent(sessionItem, index, direction)) {
        return;
      }
    } else if (!swapAdjacent(session, terminalArrayIndex, direction)) {
      return;
    }
    await configuration.save({ sessions });
  } catch (error) {
    showErrorMessageWithDetail(constants.moveTerminalFailed, error);
  }
};
