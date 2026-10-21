import type { Format } from "../types/schema";
import { FORMATS, MAX_INPUT_BYTES } from "../importers/resolve";
import { preflight } from "../importers/preflight";

// Shareable diagram links. The schema travels only in the URL fragment
// (#s=...), which browsers never send to the server: no storage, no API.
//
//   #s=v1.<base64url(deflate-raw(JSON {"f": format, "s": source}))>
//
// The version prefix sits outside the compressed data, so a later version can
// change the compression or payload without breaking v1 links.

export const SHARE_PARAM = "s";
export const SHARE_VERSION = "v1";
/**
 * Longest link we produce. Browsers accept far more (Chrome ~2 MB, Firefox
 * and Safari 64 KB+), but links are pasted into chat, email and issue
 * trackers; ~32k characters stays inside the limits of the common ones
 * (e.g. Slack's 40,000-character message) with room for surrounding text.
 */
export const MAX_SHARE_URL_LENGTH = 32_000;
export const TOO_LARGE_TO_SHARE =
  "This schema is too large to share as a link.";
export const INVALID_SHARE_LINK =
  "This share link is damaged or incomplete, so it can't be opened. Ask for a new link.";
// Decompressed JSON can be at most ~6x the source (\u escapes); stop there so a
// tampered link cannot inflate into a huge allocation.
const MAX_PAYLOAD_BYTES = MAX_INPUT_BYTES * 6 + 1024;

export type SharedSchema = { format: Format | "auto"; source: string };

export class ShareError extends Error {
  name = "ShareError";
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1)
    throw new ShareError(INVALID_SHARE_LINK);
  const binary = atob(
    text.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (text.length % 4)) % 4),
  );
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
  limit = Infinity,
): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(stream)
    .getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      throw new ShareError(INVALID_SHARE_LINK);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function shareSupported(): boolean {
  return (
    typeof CompressionStream === "function" &&
    typeof DecompressionStream === "function"
  );
}

const isFormat = (value: unknown): value is Format | "auto" =>
  value === "auto" || FORMATS.includes(value as Format);

/** Fragment value (without "#s=") for a schema. Applies the import limits. */
export async function encodeShare({
  format,
  source,
}: SharedSchema): Promise<string> {
  if (!isFormat(format) || typeof source !== "string" || !source.trim())
    throw new ShareError("Add a schema before sharing it.");
  // Same limits as pasting or opening a file (200 KB, 150 entities).
  preflight(source);
  const json = new TextEncoder().encode(
    JSON.stringify({ f: format, s: source }),
  );
  const packed = await pipe(json, new CompressionStream("deflate-raw"));
  return `${SHARE_VERSION}.${toBase64Url(packed)}`;
}

/** Full link for the current page, or a ShareError if it would be too long. */
export async function shareUrl(
  schema: SharedSchema,
  base: string,
): Promise<string> {
  const url = new URL(base);
  url.hash = "";
  const link = `${url.toString()}#${SHARE_PARAM}=${await encodeShare(schema)}`;
  if (link.length > MAX_SHARE_URL_LENGTH)
    throw new ShareError(TOO_LARGE_TO_SHARE);
  return link;
}

/** Decode a fragment value. Any damage or tampering throws a ShareError. */
export async function decodeShare(data: string): Promise<SharedSchema> {
  if (typeof data !== "string" || data.length > MAX_SHARE_URL_LENGTH)
    throw new ShareError(INVALID_SHARE_LINK);
  const dot = data.indexOf(".");
  const version = dot < 0 ? "" : data.slice(0, dot);
  if (version !== SHARE_VERSION)
    throw new ShareError(
      /^v\d+$/.test(version)
        ? "This share link was made by a newer version of SchemaMind. Reload the page and try again."
        : INVALID_SHARE_LINK,
    );
  let payload: unknown;
  try {
    const json = await pipe(
      fromBase64Url(data.slice(dot + 1)),
      new DecompressionStream("deflate-raw"),
      MAX_PAYLOAD_BYTES,
    );
    payload = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(json),
    );
  } catch {
    throw new ShareError(INVALID_SHARE_LINK);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    !isFormat((payload as any).f) ||
    typeof (payload as any).s !== "string" ||
    !(payload as any).s.trim()
  )
    throw new ShareError(INVALID_SHARE_LINK);
  const shared = { format: (payload as any).f, source: (payload as any).s };
  // A hand-made link must respect the same limits as any other input.
  try {
    preflight(shared.source);
  } catch (error) {
    throw new ShareError(
      `This share link is over the import limits. ${error instanceof Error ? error.message : ""}`.trim(),
    );
  }
  return shared;
}

/** The share payload in a location hash ("#s=..."), if any. */
export function shareFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get(SHARE_PARAM);
}
