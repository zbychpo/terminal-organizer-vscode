export var applyEnvironmentToTerminals = (input, environmentVariables) => {
  if (!environmentVariables || Object.keys(environmentVariables).length <= 0) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => applyEnvironmentToTerminals(item, environmentVariables));
  }
  if (input && typeof input === "object") {
    return { ...input, env: { ...environmentVariables, ...(input.env || {}) } };
  }
  return input;
};
