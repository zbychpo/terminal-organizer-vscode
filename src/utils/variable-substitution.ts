var VARIABLE_PATTERN = /\$\{variable:([^}]+)\}/g;

export var substituteVariable = (value, variables) => {
  if (typeof value !== "string" || !variables) {
    return value;
  }
  return value.replace(VARIABLE_PATTERN, (match, name) => {
    return Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : match;
  });
};

export var substituteVariablesDeep = (input, variables) => {
  if (!variables || Object.keys(variables).length <= 0) {
    return input;
  }
  if (typeof input === "string") {
    return substituteVariable(input, variables);
  }
  if (Array.isArray(input)) {
    return input.map((item) => substituteVariablesDeep(item, variables));
  }
  if (input && typeof input === "object") {
    const result = {};
    Object.entries(input).forEach(([key, value]) => {
      result[key] = substituteVariablesDeep(value, variables);
    });
    return result;
  }
  return input;
};
