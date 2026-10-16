import { recordUsage } from "@/lib/analytics/store";
import { randomUUID } from "node:crypto";
import {
  aiProviders,
  AIProvider,
  providerRequest,
  providerText,
} from "@/lib/services/ai-providers";
import { readJson, BodyTooLarge } from "@/lib/services/request-body";
export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (
    origin &&
    (() => {
      try {
        return (
          new URL(origin).host !==
          (req.headers.get("host") || new URL(req.url).host)
        );
      } catch {
        return true;
      }
    })()
  )
    return reply({ message: "Cross-origin requests are not allowed." }, 403);
  let tracked = false;
  let succeeded = false;
  try {
    const body = await readJson(req);
    const { schema } = body ?? {};
    if (
      !schema ||
      !Array.isArray(schema.tables) ||
      !Array.isArray(schema.relationships)
    )
      return reply({ message: "Invalid schema." }, 400);
    const provider = body.provider ?? "xai";
    if (typeof provider !== "string" || !Object.hasOwn(aiProviders, provider))
      return reply({ message: "Choose a supported AI provider." }, 400);
    tracked = true;
    const config = aiProviders[provider as AIProvider];
    const supplied = Object.hasOwn(body, "apiKey");
    const key = supplied ? body.apiKey : process.env[config.keyEnv];
    if (
      supplied &&
      (typeof key !== "string" || !/^[\x21-\x7e]{1,512}$/.test(key))
    )
      return reply(
        { message: `Enter a valid ${config.name} API key without spaces.` },
        400,
      );
    if (!key)
      return reply(
        {
          message: `${config.name} is not configured. Enter your own API key or configure ${config.keyEnv} and redeploy.`,
        },
        503,
      );
    const model = body.model || process.env[config.modelEnv] || config.model;
    if (typeof model !== "string" || !/^[a-zA-Z0-9._:-]{1,100}$/.test(model))
      return reply({ message: "Enter a valid model ID." }, 400);
    const request = providerRequest(provider as AIProvider, key, model, schema);
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      redirect: "error",
      signal: AbortSignal.timeout(55_000),
      body: JSON.stringify(request.body),
    });
    // Provider bodies can contain credentials or request fragments. Never echo them.
    if (response.status === 401 || response.status === 403)
      return reply(
        {
          code: "AI_ACCESS_DENIED",
          message: `${config.name} rejected the API key or model access. Check your key and permissions.`,
        },
        401,
      );
    if (response.status === 429)
      return reply(
        {
          message: `${config.name} usage or rate limit reached. Check your account quota and try again later.`,
        },
        429,
      );
    if (
      response.status === 400 ||
      response.status === 404 ||
      response.status === 422
    )
      return reply(
        {
          message: `${config.name} rejected the request or model. Check the model ID and account access (provider HTTP ${response.status}).`,
        },
        502,
      );
    if (!response.ok)
      return reply(
        {
          message: `${config.name} is unavailable (provider HTTP ${response.status}). Try again later.`,
        },
        502,
      );
    const data = await response.json();
    let explanation: string;
    try {
      explanation = providerText(provider as AIProvider, data);
    } catch {
      return reply(
        {
          message: `${config.name} returned an incomplete or blocked response. Try a different model or smaller schema.`,
        },
        502,
      );
    }
    if (!explanation.trim())
      return reply(
        {
          message: `${config.name} returned no explanation. Try a different model or smaller schema.`,
        },
        502,
      );
    succeeded = true;
    return reply({ explanation });
  } catch (error) {
    if (error instanceof BodyTooLarge)
      return reply({ message: error.message }, 413);
    // Parsing errors can embed request fragments (including a personal key). Do not echo them.
    return reply(
      {
        message:
          error instanceof Error &&
          (error.name === "TimeoutError" || error.name === "AbortError")
            ? "The AI provider timed out. Try a faster model or a smaller schema. Your diagram remains available."
            : "Could not reach the AI provider or read its response. Try again later. Your diagram and exports remain available.",
      },
      502,
    );
  } finally {
    if (tracked)
      await recordUsage({
        id: randomUUID(),
        kind: "explanation",
        outcome: succeeded ? "success" : "failure",
      });
  }
}
