import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { examples, formats } from "../lib/importers/catalog";
import { importSchema } from "../lib/importers";
import { showcase } from "../lib/importers/showcase";
import {
  INVALID_SHARE_LINK,
  MAX_SHARE_URL_LENGTH,
  TOO_LARGE_TO_SHARE,
  ShareError,
  decodeShare,
  encodeShare,
  shareFromHash,
  shareUrl,
} from "../lib/share/link";

const BASE = "https://schema.blackielabs.com/";
const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const v1 = (payload: unknown) =>
  "v1." + b64url(deflateRawSync(Buffer.from(JSON.stringify(payload))));

test("round-trips every format (and auto) to the same source and diagram", async () => {
  const cases = [
    ...formats.map(({ id }) => ({ format: id, source: examples[id] })),
    { format: "auto" as const, source: showcase.source },
    {
      format: "postgresql" as const,
      source:
        "CREATE TABLE \"émoji 🚀\" (id INT PRIMARY KEY, note TEXT DEFAULT '</script><img src=x>');",
    },
  ];
  for (const shared of cases) {
    const link = await shareUrl(shared, BASE + "?x=1#old");
    assert.ok(link.startsWith(BASE + "?x=1#s=v1."), link.slice(0, 60));
    assert.match(link.split("#s=")[1], /^v1\.[A-Za-z0-9_-]+$/);
    const data = shareFromHash(new URL(link).hash);
    const back = await decodeShare(data!);
    assert.deepEqual(back, shared);
    // Decoded text is plain parser input: same parse result as the original.
    if (shared.format !== "auto")
      assert.deepEqual(
        importSchema(back.source, back.format),
        importSchema(shared.source, shared.format),
      );
  }
});

test("versioning: v1 is required; other versions get a clear message", async () => {
  const good = await encodeShare({ format: "prisma", source: examples.prisma });
  assert.ok(good.startsWith("v1."));
  await assert.rejects(
    decodeShare(good.replace(/^v1\./, "v2.")),
    /newer version of SchemaMind/,
  );
  await assert.rejects(decodeShare(good.replace(/^v1\./, "")), {
    message: INVALID_SHARE_LINK,
  });
  await assert.rejects(decodeShare("x" + good), {
    message: INVALID_SHARE_LINK,
  });
});

test("corrupt or tampered links are rejected with one clear error", async () => {
  const good = await encodeShare({
    format: "postgresql",
    source: examples.postgresql,
  });
  const corrupt = [
    "",
    "v1.",
    "v1.!!!!",
    "v1.A",
    good.slice(0, Math.floor(good.length / 2)), // truncated
    good.slice(0, -6) + "AAAAAA", // tail tampered
    "v1." + b64url(new TextEncoder().encode("not deflate")),
    v1(["array"]),
    v1({ f: "oracle", s: "CREATE TABLE a (id int);" }), // unknown format
    v1({ f: "postgresql", s: 42 }),
    v1({ f: "postgresql", s: "   " }),
    "v1." + b64url(deflateRawSync(Buffer.from([0xff, 0xfe, 0x00]))), // not UTF-8 JSON
  ];
  for (const data of corrupt)
    await assert.rejects(decodeShare(data), (error: Error) => {
      assert.ok(error instanceof ShareError, data);
      assert.equal(error.message, INVALID_SHARE_LINK, data);
      return true;
    });
});

test("hand-made links still obey the import limits; inflation is capped", async () => {
  const many = Array.from(
    { length: 151 },
    (_, i) => `CREATE TABLE t${i} (id INT);`,
  ).join("\n");
  await assert.rejects(
    decodeShare(v1({ f: "postgresql", s: many })),
    /over the import limits\. Limit: 150 entities/,
  );
  await assert.rejects(
    decodeShare(v1({ f: "postgresql", s: "x".repeat(200_001) })),
    /200 KB import limit/,
  );
  // A small link that inflates past the payload cap is refused while streaming.
  const bomb = "v1." + b64url(deflateRawSync(Buffer.alloc(5_000_000, 0x20)));
  assert.ok(bomb.length < 10_000);
  await assert.rejects(decodeShare(bomb), { message: INVALID_SHARE_LINK });
  // Encoding applies the same limits as paste.
  await assert.rejects(
    encodeShare({ format: "postgresql", source: many }),
    /Limit: 150 entities/,
  );
  await assert.rejects(
    encodeShare({ format: "postgresql", source: "" }),
    ShareError,
  );
});

test(`links longer than ${MAX_SHARE_URL_LENGTH} characters are refused, not truncated`, async () => {
  // Random-ish identifiers barely compress, so this exceeds the cap well under 200 KB.
  let seed = 1;
  const word = () => {
    let w = "c";
    for (let i = 0; i < 12; i++)
      w += "abcdefghijklmnopqrstuvwxyz"[
        (seed = (seed * 48271) % 2147483647) % 26
      ];
    return w;
  };
  const tables = Array.from(
    { length: 140 },
    (_, i) =>
      `CREATE TABLE t${i}_${word()} (id INT PRIMARY KEY, ${Array.from({ length: 30 }, () => `${word()} TEXT`).join(", ")});`,
  ).join("\n");
  assert.ok(new TextEncoder().encode(tables).length < 200_000);
  await assert.rejects(
    shareUrl({ format: "postgresql", source: tables }, BASE),
    {
      message: TOO_LARGE_TO_SHARE,
    },
  );
  await assert.rejects(decodeShare("v1." + "A".repeat(MAX_SHARE_URL_LENGTH)), {
    message: INVALID_SHARE_LINK,
  });
  // The examples fit easily.
  const link = await shareUrl(
    { format: "auto", source: showcase.source },
    BASE,
  );
  assert.ok(link.length < 3000, String(link.length));
});

test("shareFromHash reads only the s parameter", () => {
  assert.equal(shareFromHash("#s=v1.abc"), "v1.abc");
  assert.equal(shareFromHash("#support"), null);
  assert.equal(shareFromHash(""), null);
});
