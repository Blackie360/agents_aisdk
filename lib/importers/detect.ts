import { Format } from "../types/schema";
export function detectFormat(text: string): Format | null {
  const source = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*(?:\/\/|--).*$/gm, "")
    .trim();
  if (/\bfrom\s*['"]drizzle-orm\/(?:pg|mysql|sqlite)-core['"]/.test(source))
    return "drizzle";
  if (/^\s*(?:model|datasource|generator|enum)\s+\w+\s*\{/m.test(source))
    return "prisma";
  if (source.startsWith("{") || source.startsWith("[")) {
    try {
      const data = JSON.parse(text);
      const first = Array.isArray(data) ? data[0] : data;
      if (first && typeof first.name === "string" && first.columns)
        return "typeorm";
      if (data && !Array.isArray(data) && data.properties) return "json-schema";
    } catch {
      /* Report a format choice rather than fabricate a parse. */
    }
  }
  if (/\bCREATE\s+TABLE\b/i.test(source)) {
    const hints: Format[] = [];
    const tokens = source.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`/g, "");
    if (/\bAUTO_INCREMENT\b|\bENGINE\s*=/i.test(tokens)) hints.push("mysql");
    if (/\bAUTOINCREMENT\b|\bWITHOUT\s+ROWID\b|\bPRAGMA\b/i.test(tokens))
      hints.push("sqlite");
    if (
      /\b(?:BIGSERIAL|SMALLSERIAL|SERIAL|JSONB|TIMESTAMPTZ)\b|\bCREATE\s+(?:TYPE|EXTENSION)\b/i.test(
        tokens,
      )
    )
      hints.push("postgresql");
    return hints.length === 1 ? hints[0] : null;
  }
  return null;
}
