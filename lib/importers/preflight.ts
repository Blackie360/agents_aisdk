import { postgresStatements } from "../parsers/postgres-statements";
/** Cheap structural guard: runs before loading parsers, accepting input or restoring drafts. */
export function preflight(input: string) {
  if (new TextEncoder().encode(input).length > 200_000)
    throw new Error("Schema exceeds the 200 KB import limit.");
  if (
    /\bcreate\s+(?:(?:global|local)\s+)?(?:(?:temporary|temp|unlogged)\s+)?table\b/i.test(
      input,
    )
  ) {
    let statements;
    try {
      statements = postgresStatements(input);
    } catch {
      return;
    } // Syntax errors belong to the importer.
    const count = statements.filter(
      ({ words }) =>
        words[0] === "create" && words.slice(1, 4).includes("table"),
    ).length;
    if (count > 150)
      throw new Error(
        "Limit: 150 entities per import. Split this schema into smaller files; this input was not saved.",
      );
  }
}
export function importError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Import failed.";
  if (
    /syntax error|unexpected .*token|expected .*but|parse error/i.test(message)
  ) {
    const location = message.match(/line\s+(\d+)(?:\s+col(?:umn)?\s+(\d+))?/i);
    return `Invalid schema syntax${location ? ` at line ${location[1]}${location[2] ? `, column ${location[2]}` : ""}` : ""}. Check punctuation and the selected format. Some database-specific syntax may be unsupported.`;
  }
  return message;
}

/** Per-editor cache: retain only the last accepted value, never cache failures. */
export function createPreflightGuard() {
  let accepted: string | undefined;
  return (input: string) => {
    if (input === accepted) return;
    preflight(input);
    accepted = input;
  };
}
