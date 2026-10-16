// prisma-ast looks for an optional local config file. Browser imports always
// use its defaults: no filesystem access and no project configuration execution.
export const lilconfigSync = () => ({ search: () => null });
