import { Configuration } from '../configuration/configuration';
import { constants } from '../utils/constants';
import { swapAdjacent } from '../utils/reorder';
import { showErrorMessageWithDetail } from '../utils/utils';

export var moveSessionActivityAsync = async (sessionTreeItem, direction) => {
  try {
    const { sessionId } = sessionTreeItem || {};
    if (!sessionId) {
      return;
    }
    const config = await Configuration.load();
    if (!config?.sessions) {
      return;
    }
    const sessionNames = Object.keys(config.sessions);
    const index = sessionNames.indexOf(sessionId);
    if (index === -1 || !swapAdjacent(sessionNames, index, direction)) {
      return;
    }
    const sessions = {};
    sessionNames.forEach((name) => {
      sessions[name] = config.sessions[name];
    });
    await Configuration.save({ sessions });
  } catch (error) {
    showErrorMessageWithDetail(constants.moveSessionFailed, error);
  }
};
