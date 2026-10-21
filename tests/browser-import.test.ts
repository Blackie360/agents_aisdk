import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  ImportCancelled,
  PARSER_LOAD_TIMEOUT_MS,
  PARSE_TIMEOUT_MS,
  ParserLoadError,
  importInBrowser,
} from "../lib/services/browser-import";

// Minimal stand-in for the dedicated worker: records posts, lets tests reply.
class FakeWorker {
  static last: FakeWorker | null = null;
  posted: any[] = [];
  terminated = false;
  onmessage: ((event: { data: any }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeWorker.last = this;
  }
  postMessage(data: any) {
    this.posted.push(data);
  }
  terminate() {
    this.terminated = true;
  }
  reply(data: any) {
    this.onmessage?.({ data });
  }
}
(globalThis as any).Worker = FakeWorker;
const lastId = () => FakeWorker.last!.posted.at(-1).id;

test("the parse timeout starts only once the parser chunk has loaded", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const result = importInBrowser("model A { id Int @id }", "prisma");
    const worker = FakeWorker.last!;
    const id = lastId();
    // A slow download well past the 30s parse budget does not fail the import.
    mock.timers.tick(PARSE_TIMEOUT_MS + 20_000);
    worker.reply({ id, phase: "loaded" });
    mock.timers.tick(PARSE_TIMEOUT_MS - 1);
    worker.reply({ id, schema: { tables: [], relationships: [] } });
    assert.deepEqual(await result, { tables: [], relationships: [] });
    assert.equal(worker.terminated, false);
  } finally {
    mock.timers.reset();
  }
});

test("parse and download budgets are enforced separately", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const slowParse = importInBrowser("model A { id Int @id }", "prisma");
    FakeWorker.last!.reply({ id: lastId(), phase: "loaded" });
    mock.timers.tick(PARSE_TIMEOUT_MS);
    await assert.rejects(slowParse, /Parsing timed out/);
    const stuckDownload = importInBrowser("model A { id Int @id }", "prisma");
    mock.timers.tick(PARSER_LOAD_TIMEOUT_MS);
    await assert.rejects(stuckDownload, ParserLoadError);
  } finally {
    mock.timers.reset();
  }
});

test("a failed parser download is a retryable ParserLoadError with a fresh worker", async () => {
  const first = importInBrowser("model A { id Int @id }", "prisma");
  const worker = FakeWorker.last!;
  worker.reply({ id: lastId(), loadError: true });
  await assert.rejects(first, ParserLoadError);
  assert.equal(worker.terminated, true);
  const retry = importInBrowser("model A { id Int @id }", "prisma");
  assert.notEqual(FakeWorker.last, worker);
  FakeWorker.last!.reply({ id: lastId(), schema: { tables: [] } });
  assert.deepEqual(await retry, { tables: [] });
});

test("a superseded import rejects as ImportCancelled, not as a failure", async () => {
  const older = importInBrowser("model A { id Int @id }", "prisma");
  const olderId = lastId();
  const newer = importInBrowser("model B { id Int @id }", "prisma");
  await assert.rejects(older, ImportCancelled);
  // A late reply to the older request is ignored.
  FakeWorker.last!.reply({ id: olderId, schema: { tables: ["old"] } });
  FakeWorker.last!.reply({ id: lastId(), schema: { tables: ["new"] } });
  assert.deepEqual(await newer, { tables: ["new"] });
});
