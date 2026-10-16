/** Split PostgreSQL scripts without treating quoted function bodies as DDL. */
export function postgresStatements(source: string) {
  const statements: { text: string; words: string[] }[] = [];
  let text = "",
    words: string[] = [],
    i = 0;
  const flush = () => {
    if (text.trim()) statements.push({ text, words });
    text = "";
    words = [];
  };
  while (i < source.length) {
    if (source.startsWith("--", i)) {
      const end = source.indexOf("\n", i + 2);
      i = end < 0 ? source.length : end;
      text += " ";
      continue;
    }
    if (source.startsWith("/*", i)) {
      let depth = 1;
      i += 2;
      while (i < source.length && depth) {
        if (source.startsWith("/*", i)) {
          depth++;
          i += 2;
        } else if (source.startsWith("*/", i)) {
          depth--;
          i += 2;
        } else i++;
      }
      if (depth) throw new Error("Unterminated SQL block comment.");
      text += " ";
      continue;
    }
    const char = source[i];
    if (char === "'" || char === '"') {
      const start = i++;
      const escaped =
        char === "'" &&
        /[eE]/.test(source[start - 1] ?? "") &&
        !/[\w$]/.test(source[start - 2] ?? "");
      let closed = false;
      while (i < source.length) {
        if (escaped && source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i++] === char) {
          if (source[i] === char) {
            i++;
            continue;
          }
          closed = true;
          break;
        }
      }
      if (!closed)
        throw new Error("Unterminated SQL quoted value or identifier.");
      text += source.slice(start, i);
      continue;
    }
    const dollar =
      char === "$" &&
      source.slice(i).match(/^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/)?.[0];
    if (dollar) {
      const end = source.indexOf(dollar, i + dollar.length);
      if (end < 0) throw new Error("Unterminated SQL dollar-quoted body.");
      text += source.slice(i, end + dollar.length);
      i = end + dollar.length;
      continue;
    }
    const word = source.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_$]*/)?.[0];
    if (word) {
      // SQL-standard unquoted routine bodies need a full procedural grammar.
      // Reject them rather than mistake an embedded CREATE TABLE for real DDL.
      if (
        word.toLowerCase() === "begin" &&
        words[0] === "create" &&
        ["function", "procedure"].includes(
          words[words[1] === "or" && words[2] === "replace" ? 3 : 1],
        )
      )
        throw new Error(
          "Unquoted SQL routine bodies are unsupported. Use a schema-only export or dollar-quoted function bodies.",
        );
      if (words.length < 8) words.push(word.toLowerCase());
      text += word;
      i += word.length;
      continue;
    }
    if (char === ";") {
      flush();
      i++;
      continue;
    }
    text += char;
    i++;
  }
  flush();
  return statements;
}
