import { test } from "node:test";
import assert from "node:assert/strict";
import { readApiResponse } from "../lib/services/api-response";

test("empty and HTML responses preserve status without exposing response content", async () => {
  await assert.rejects(
    readApiResponse(new Response(null, { status: 204 })),
    /empty response \(HTTP 204\)/,
  );
  await assert.rejects(
    readApiResponse(
      new Response("<html>private proxy details</html>", { status: 502 }),
    ),
    /non-JSON response \(HTTP 502\)/,
  );
  await assert.rejects(
    readApiResponse(new Response("private", { status: 401 })),
    /deployment access/,
  );
});
test("valid API results and application errors remain useful", async () => {
  assert.deepEqual(
    await readApiResponse(Response.json({ explanation: "ok" })),
    { explanation: "ok" },
  );
  await assert.rejects(
    readApiResponse(
      Response.json({ message: "Choose a dialect" }, { status: 400 }),
    ),
    /Choose a dialect/,
  );
  await assert.rejects(
    readApiResponse(Response.json(null)),
    /invalid response/,
  );
});

test("sanitized AI access errors remain actionable for 401 and 403", async () => {
  for (const status of [401, 403]) {
    await assert.rejects(
      readApiResponse(
        Response.json(
          {
            code: "AI_ACCESS_DENIED",
            message: "xAI rejected the API key or model access.",
          },
          { status },
        ),
      ),
      /xAI rejected/,
    );
    await assert.rejects(
      readApiResponse(
        Response.json({ message: "private proxy details" }, { status }),
      ),
      /deployment access/,
    );
  }
});
