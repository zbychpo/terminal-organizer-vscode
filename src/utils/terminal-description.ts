// A terminal's "description" is free text that can span several lines: stored
// as a plain string when it's one line, or as an array of lines (easier to
// read and edit in sessions.json) when it's more. Both forms are accepted.

export var getTerminalDescriptionText = (terminal) => {
  const value = terminal?.description;
  if (Array.isArray(value)) {
    return value.map((line) => `${line}`).join("\n");
  }
  return typeof value === "string" ? value : "";
};

export var toStoredDescription = (text) => {
  const normalized = `${text ?? ""}`.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  if (normalized === "") {
    return undefined;
  }
  const lines = normalized.split("\n");
  return lines.length > 1 ? lines : normalized;
};
