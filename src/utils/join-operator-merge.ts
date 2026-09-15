export var applyGlobalJoinOperator = (input, globalJoinOperator) => {
  if (!globalJoinOperator) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => applyGlobalJoinOperator(item, globalJoinOperator));
  }
  if (input && typeof input === "object") {
    return { joinOperator: globalJoinOperator, ...input };
  }
  return input;
};
