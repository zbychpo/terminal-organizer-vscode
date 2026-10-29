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
  const { inherits = [], mask: _mask, ...ownVariables } = environment;
  const nextAncestors = [...ancestors, name];
  let merged = {};
  for (const parentName of inherits) {
    merged = { ...merged, ...resolveEnvironmentVariables(environments, parentName, nextAncestors) };
  }
  return { ...merged, ...ownVariables };
};

export var resolveMaskedVariableNames = (environments, name, ancestors = []) => {
  if (!name || !environments || !Object.prototype.hasOwnProperty.call(environments, name)) {
    return new Set();
  }
  if (ancestors.includes(name)) {
    return new Set();
  }
  const environment = environments[name] || {};
  const inherits = Array.isArray(environment.inherits) ? environment.inherits : [];
  const ownMask = Array.isArray(environment.mask) ? environment.mask : [];
  const nextAncestors = [...ancestors, name];
  const masked = new Set(ownMask);
  inherits.forEach((parentName) => {
    resolveMaskedVariableNames(environments, parentName, nextAncestors).forEach((variableName) => masked.add(variableName));
  });
  return masked;
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

// Environments assigned to a terminal: its session's (top-level
// "sessionEnvironments") first, then its own "environments" - a later one
// overrides an earlier one. Names that aren't defined in "environments" are
// ignored.
export var getAssignedEnvironmentNames = (environments, terminal, sessionEnvironmentNames?: string[]) => {
  const own = Array.isArray(terminal?.environments) ? terminal.environments : [];
  const names = [...(Array.isArray(sessionEnvironmentNames) ? sessionEnvironmentNames : []), ...own];
  return names.filter(
    (name, index) => typeof name === "string" && !!environments && Object.prototype.hasOwnProperty.call(environments, name) && names.lastIndexOf(name) === index
  );
};

// The environments that actually apply to a terminal: the assigned ones, or -
// only when nothing is assigned - the active (default) environment.
export var getTerminalEnvironmentNames = (environments, terminal, sessionEnvironmentNames?: string[], activeEnvironment?: string) => {
  const assigned = getAssignedEnvironmentNames(environments, terminal, sessionEnvironmentNames);
  if (assigned.length > 0) {
    return assigned;
  }
  return activeEnvironment && Object.prototype.hasOwnProperty.call(environments || {}, activeEnvironment) ? [activeEnvironment] : [];
};

export var resolveEnvironmentListVariables = (environments, names: string[]) =>
  names.reduce((merged, name) => ({ ...merged, ...resolveEnvironmentVariables(environments, name) }), {});

export var resolveEnvironmentListMaskedNames = (environments, names: string[]) => {
  const masked = new Set<string>();
  names.forEach((name) => resolveMaskedVariableNames(environments, name).forEach((variableName: string) => masked.add(variableName)));
  return masked;
};

// Like applyEnvironmentToTerminals(), but per terminal: each one gets the
// environments getTerminalEnvironmentNames() picks for it. The terminal's
// "environments" key is dropped - it's not a terminal option.
export var applyEnvironmentsToTerminals = (input, environments, activeEnvironment?: string, sessionEnvironmentNames?: string[]) => {
  if (Array.isArray(input)) {
    return input.map((item) => applyEnvironmentsToTerminals(item, environments, activeEnvironment, sessionEnvironmentNames));
  }
  if (!input || typeof input !== "object") {
    return input;
  }
  const { environments: _assigned, ...terminal } = input;
  const names = getTerminalEnvironmentNames(environments, input, sessionEnvironmentNames, activeEnvironment);
  return applyEnvironmentToTerminals(terminal, resolveEnvironmentListVariables(environments, names));
};

export var getSessionEnvironmentNames = (config, sessionName): string[] => {
  const names = config?.sessionEnvironments?.[sessionName];
  return Array.isArray(names) ? names : [];
};
