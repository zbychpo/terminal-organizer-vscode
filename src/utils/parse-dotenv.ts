export var parseDotEnv = (content: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = line.match(/^(?:export\s+)?([^=\s]+)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }
    const key = match[1];
    let value = match[2] ?? "";
    const isDoubleQuoted = value.length >= 2 && value.startsWith('"') && value.endsWith('"');
    const isSingleQuoted = value.length >= 2 && value.startsWith("'") && value.endsWith("'");
    if (isDoubleQuoted || isSingleQuoted) {
      value = value.slice(1, -1);
      if (isDoubleQuoted) {
        value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, '"');
      }
    } else {
      const commentIndex = value.indexOf(" #");
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex);
      }
      value = value.trim();
    }
    if (key) {
      result[key] = value;
    }
  }
  return result;
};
