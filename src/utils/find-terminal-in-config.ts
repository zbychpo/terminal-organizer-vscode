import { Configuration } from '../configuration/configuration';

export var findTerminal = async (sessionId, terminalArrayIndex, terminalItemName) => {
  console.log("findTerminal", sessionId, terminalArrayIndex, terminalItemName);
  if (!sessionId || terminalArrayIndex === undefined) {
    return undefined;
  }
  const isDefinedSessionFile = await Configuration.isDefinedSessionFile();
  if (!isDefinedSessionFile) {
    return undefined;
  }
  const config = await Configuration.load();
  if (!config || !config.sessions) {
    return undefined;
  }
  const session = config.sessions[sessionId];
  if (!session || session.length <= 0) {
    return undefined;
  }
  const sessionItem = session[terminalArrayIndex];
  if (!sessionItem) {
    return undefined;
  }
  if (!terminalItemName) {
    return sessionItem;
  }
  let foundTerminal = undefined;
  if (Array.isArray(sessionItem)) {
    const terminalInArray = sessionItem.find((item) => item.name === terminalItemName);
    if (terminalInArray) {
      foundTerminal = terminalInArray;
    }
  } else {
    if (sessionItem.name === terminalItemName) {
      foundTerminal = sessionItem;
    }
  }
  return foundTerminal;
};

export var findTerminalByName = async (terminalName, sessionId) => {
  const isDefinedSessionFile = await Configuration.isDefinedSessionFile();
  if (!isDefinedSessionFile) {
    return undefined;
  }
  const config = await Configuration.load();
  if (!config?.sessions) {
    return undefined;
  }
  const sessionsToSearch = sessionId ? { [sessionId]: config.sessions[sessionId] } : config.sessions;
  for (const [sid, sessionItems] of Object.entries(sessionsToSearch)) {
    if (!sessionItems) {
      continue;
    }
    for (let index = 0; index < sessionItems.length; index++) {
      const item = sessionItems[index];
      if (Array.isArray(item)) {
        const found = item.find((t) => t.name === terminalName);
        if (found) {
          return { terminal: item, sessionId: sid, index };
        }
      } else if (item.name === terminalName) {
        return { terminal: item, sessionId: sid, index };
      }
    }
  }
  return undefined;
};
