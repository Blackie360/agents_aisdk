import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NOT_A_SCHEMA_FILE,
  looksBinary,
  readSchemaFile,
} from "../lib/importers/file-check";

const jpeg = () => {
  const bytes = new Uint8Array(165_000);
  bytes.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
  for (let i = 11; i < bytes.length; i++) bytes[i] = (i * 31) & 0xff;
  return bytes;
};

test("binary and non-text files are 'not a schema file', whatever their name", async () => {
  for (const blob of [
    new Blob([jpeg()], { type: "image/jpeg" }),
    new Blob([jpeg()]), // no MIME type (e.g. renamed to .sql)
    new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x0a, 0x00, 0x01])], {
      type: "application/pdf",
    }),
    new Blob([new Uint8Array([0x63, 0x72, 0xe9, 0x28, 0xa0, 0xa1])]), // invalid UTF-8
  ])
    await assert.rejects(readSchemaFile(blob), { message: NOT_A_SCHEMA_FILE });
  assert.equal(
    looksBinary(new TextEncoder().encode("CREATE TABLE a (id int);\n\tx")),
    false,
  );
});

test("an over-limit schema file names the 200 KB limit, same as paste", async () => {
  const big = new Blob(["-- x\n".repeat(50_000)], { type: "application/sql" });
  await assert.rejects(readSchemaFile(big), {
    message: "Schema exceeds the 200 KB import limit.",
  });
  assert.equal(
    await readSchemaFile(
      new Blob(["CREATE TABLE é (id int);"], { type: "text/plain" }),
    ),
    "CREATE TABLE é (id int);",
  );
});

test("empty and whitespace-only files are 'This file is empty.'", async () => {
  for (const content of ["", "   \n\t\r\n ", "\uFEFF\n"])
    await assert.rejects(
      readSchemaFile(new Blob([content], { type: "application/sql" })),
      {
        message: "This file is empty.",
      },
    );
});
