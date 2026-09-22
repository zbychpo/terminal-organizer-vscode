export var hasCircularInheritance = (environments, name, ancestors = []) => {
  if (!name || !environments || !Object.prototype.hasOwnProperty.call(environments, name)) {
    return false;
  }
  if (ancestors.includes(name)) {
    return true;
  }
  const environment = environments[name] || {};
  const inherits = Array.isArray(environment.inherits) ? environment.inherits : [];
  const nextAncestors = [...ancestors, name];
  return inherits.some((parentName) => hasCircularInheritance(environments, parentName, nextAncestors));
};

export var resolveEnvironmentVariables = (environments, name, ancestors = []) => {
  if (!name || !environments || !Object.prototype.hasOwnProperty.call(environments, name)) {
    return {};
  }
  if (ancestors.includes(name)) {
    return {};
  }
  const environment = environments[name] || {};
  const { inherits = [], ...ownVariables } = environment;
  const nextAncestors = [...ancestors, name];
  let merged = {};
  for (const parentName of inherits) {
    merged = { ...merged, ...resolveEnvironmentVariables(environments, parentName, nextAncestors) };
  }
  return { ...merged, ...ownVariables };
};

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
