// Path-only discovery in a user-selected local folder. File contents are read only on selection.
export function isSchemaCandidate(path: string): boolean {
  if (/(^|\/)(node_modules|\.git|\.next|dist|build|vendor)(\/|$)/.test(path))
    return false;
  return (
    /\.prisma$/i.test(path) ||
    /\.sql$/i.test(path) ||
    /(?:^|\/)(?:schema|entities?)(?:\.[\w-]+)?\.(?:ts|js|json)$/i.test(path) ||
    /(?:^|\/)(?:schema|entities)\/[^/]+\.(?:ts|js|json)$/i.test(path)
  );
}
