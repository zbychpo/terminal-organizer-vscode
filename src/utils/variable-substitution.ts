var VARIABLE_PATTERN = /\$\{variable:([^}]+)\}/g;

export var substituteVariable = (value, variables) => {
  if (typeof value !== "string" || !variables) {
    return value;
  }
  return value.replace(VARIABLE_PATTERN, (match, name) => {
    return Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : match;
  });
};

// Resolves ${variable:NAME} references between the variables themselves, e.g.
// { javaHome: "C:/jdk", javaBin: "${variable:javaHome}/bin" }, to any depth.
// A reference that's part of a cycle (a -> b -> a) or names an unknown
// variable is left as-is instead of looping or failing.
export var resolveVariableReferences = (variables) => {
  if (!variables || typeof variables !== "object") {
    return variables;
  }
  const resolved = {};
  const resolving = new Set();
  const resolveName = (name) => {
    if (Object.prototype.hasOwnProperty.call(resolved, name)) {
      return resolved[name];
    }
    const raw = variables[name];
    if (typeof raw !== "string" || !raw.includes("${variable:")) {
      resolved[name] = raw;
      return raw;
    }
    if (resolving.has(name)) {
      return undefined;
    }
    resolving.add(name);
    const value = raw.replace(new RegExp(VARIABLE_PATTERN.source, "g"), (match, ref) => {
      if (!Object.prototype.hasOwnProperty.call(variables, ref)) {
        return match;
      }
      const refValue = resolveName(ref);
      return typeof refValue === "string" ? refValue : match;
    });
    resolving.delete(name);
    resolved[name] = value;
    return value;
  };
  Object.keys(variables).forEach(resolveName);
  return resolved;
};

var substituteDeep = (input, variables) => {
  if (typeof input === "string") {
    return substituteVariable(input, variables);
  }
  if (Array.isArray(input)) {
    return input.map((item) => substituteDeep(item, variables));
  }
  if (input && typeof input === "object") {
    const result = {};
    Object.entries(input).forEach(([key, value]) => {
      result[key] = substituteDeep(value, variables);
    });
    return result;
  }
  return input;
};

export var substituteVariablesDeep = (input, variables) => {
  if (!variables || Object.keys(variables).length <= 0) {
    return input;
  }
  return substituteDeep(input, resolveVariableReferences(variables));
};
