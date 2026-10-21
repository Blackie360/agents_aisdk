import { MAX_INPUT_BYTES } from "./resolve";

export const NOT_A_SCHEMA_FILE =
  "This isn't a schema file. Open a text schema such as .sql, .prisma, .ts or .json.";

const BINARY_TYPE =
  /^(?:image|audio|video|font)\/|^application\/(?:pdf|zip|gzip|x-7z|x-rar|x-tar|octet-stream|vnd\.|msword|x-msdownload|wasm)/;

/** True when the bytes are clearly not text (NUL bytes or many control characters). */
export function looksBinary(bytes: Uint8Array): boolean {
  let control = 0;
  for (const b of bytes) {
    if (b === 0) return true;
    if (b < 32 && b !== 9 && b !== 10 && b !== 13 && b !== 12) control++;
  }
  return bytes.length > 0 && control / bytes.length > 0.1;
}

/**
 * Read an opened file as schema text, or throw the message the user sees:
 * binary/non-text files are named as such; over-size files get the same
 * limit message as pasting.
 */
export async function readSchemaFile(file: Blob): Promise<string> {
  if (file.type && BINARY_TYPE.test(file.type))
    throw new Error(NOT_A_SCHEMA_FILE);
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  if (looksBinary(head)) throw new Error(NOT_A_SCHEMA_FILE);
  if (file.size > MAX_INPUT_BYTES)
    // Same message as pasting an over-size schema (preflight).
    throw new Error("Schema exceeds the 200 KB import limit.");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
  } catch {
    throw new Error(NOT_A_SCHEMA_FILE);
  }
}
