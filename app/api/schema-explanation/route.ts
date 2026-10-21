import { recordUsage } from "@/lib/analytics/store";
import { randomUUID } from "node:crypto";
import {
  aiProviders,
  classifyProviderFailure,
  AIProvider,
  providerRequest,
  providerText,
} from "@/lib/services/ai-providers";
import { readJson, BodyTooLarge } from "@/lib/services/request-body";
import {
  consume,
  GLOBAL_SUBJECT,
  ipSubject,
  isProduction,
  peek,
  rules,
} from "@/lib/security/rate-limit";
import { schemaSizeError } from "@/lib/security/schema-limits";
import {
  authEnabled,
  configuredProviders,
  currentUser,
} from "@/lib/auth/server";
export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (
  body: object,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
// Secondary trial signal: free explanations used in this browser. The IP
// counter in the shared store is authoritative; this only adds strictness
// (the higher of the two counts wins), so clearing it gains nothing.
const TRIAL_COOKIE = "schemamind_trials";
function cookieTrials(req: Request): number {
  const match = (req.headers.get("cookie") ?? "").match(
    new RegExp(`(?:^|;\\s*)${TRIAL_COOKIE}=(\\d{1,3})(?:;|$)`),
  );
  return match ? Number(match[1]) : 0;
}
type Context = { setCookie?: string };
export async function POST(req: Request) {
  const ctx: Context = {};
  const response = await handle(req, ctx);
  if (ctx.setCookie) response.headers.append("Set-Cookie", ctx.setCookie);
  return response;
}
async function handle(req: Request, ctx: Context): Promise<Response> {
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
  // Burst limit for every caller, before the body is read.
  const ip = ipSubject(req);
  const burst = await consume([{ rule: rules.explainBurst(), subject: ip }]);
  if (burst.status === "limited")
    return reply(
      {
        message: "Too many explanation requests. Wait a minute and try again.",
      },
      429,
      { "Retry-After": String(burst.retryAfter) },
    );
  let tracked = false;
  let succeeded = false;
  try {
    const body = await readJson(req);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return reply({ message: "Invalid schema." }, 400);
    const { schema } = body;
    if (
      !schema ||
      !Array.isArray(schema.tables) ||
      !Array.isArray(schema.relationships)
    )
      return reply({ message: "Invalid schema." }, 400);
    const tooLarge = schemaSizeError(schema);
    if (tooLarge) return reply({ message: tooLarge }, 413);
    const supplied = Object.hasOwn(body, "apiKey");
    // Only a caller paying with their own key may choose provider and model.
    // When the server key pays, body.provider and body.model are ignored.
    const provider = supplied
      ? (body.provider ?? "xai")
      : process.env.SERVER_AI_PROVIDER || "xai";
    if (typeof provider !== "string" || !Object.hasOwn(aiProviders, provider))
      return supplied
        ? reply({ message: "Choose a supported AI provider." }, 400)
        : reply(
            {
              message:
                "The server AI provider is misconfigured. Enter your own API key to continue.",
            },
            503,
          );
    tracked = true;
    const config = aiProviders[provider as AIProvider];
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
    const model = supplied
      ? body.model || process.env[config.modelEnv] || config.model
      : process.env[config.modelEnv] || config.model;
    if (typeof model !== "string" || !/^[a-zA-Z0-9._:-]{1,100}$/.test(model))
      return reply({ message: "Enter a valid model ID." }, 400);
    let trialsLeft: number | null = null;
    const user = supplied ? null : await currentUser(req);
    if (!supplied && !user) {
      // Signed-out visitors get a few free server-key explanations, counted
      // per IP bucket in the shared store (checked here, charged below once
      // the daily caps pass, so a capped request never burns a trial).
      const trial = await peek({ rule: rules.anonTrial(), subject: ip });
      if (trial.status === "unavailable")
        return reply(
          {
            code: "SERVER_KEY_UNAVAILABLE",
            message:
              "Free explanations are unavailable right now. Enter your own API key to continue.",
          },
          503,
        );
      const limit = rules.anonTrial().limit;
      if (Math.max(trial.hits, cookieTrials(req)) >= limit)
        return reply(
          {
            error: "signup_required",
            code: "SIGNUP_REQUIRED",
            message: `You've used your ${limit} free explanations. Sign in to keep going, or bring your own API key.`,
            providers: authEnabled() ? configuredProviders() : [],
          },
          401,
        );
    }
    if (!supplied) {
      // Server key pays: enforce the per-IP daily cap, then the global daily
      // cap (so one capped IP cannot drain the global allowance), in the
      // shared store, and fail closed if the store is unavailable.
      let daily =
        burst.status === "unavailable"
          ? burst
          : await consume([{ rule: rules.serverKeyDailyPerIp(), subject: ip }]);
      if (daily.status === "ok")
        daily = await consume([
          { rule: rules.serverKeyDailyGlobal(), subject: GLOBAL_SUBJECT },
        ]);
      if (daily.status === "unavailable")
        return reply(
          {
            code: "SERVER_KEY_UNAVAILABLE",
            message:
              "Free explanations are unavailable right now. Enter your own API key to continue.",
          },
          503,
        );
      if (daily.status === "limited")
        return reply(
          {
            code: "SERVER_KEY_LIMIT",
            message:
              "Free explanations have reached today's limit. Enter your own API key to keep going, or try again tomorrow.",
          },
          429,
          { "Retry-After": String(daily.retryAfter) },
        );
      if (!user) {
        const rule = rules.anonTrial();
        const charged = await consume([{ rule, subject: ip }]);
        if (charged.status === "unavailable")
          return reply(
            {
              code: "SERVER_KEY_UNAVAILABLE",
              message:
                "Free explanations are unavailable right now. Enter your own API key to continue.",
            },
            503,
          );
        if (charged.status === "limited")
          return reply(
            {
              error: "signup_required",
              code: "SIGNUP_REQUIRED",
              message: `You've used your ${rule.limit} free explanations. Sign in to keep going, or bring your own API key.`,
              providers: authEnabled() ? configuredProviders() : [],
            },
            401,
          );
        const used = Math.min(
          999,
          Math.max(charged.hits?.[0] ?? 0, cookieTrials(req) + 1),
        );
        trialsLeft = Math.max(0, rule.limit - used);
        ctx.setCookie = `${TRIAL_COOKIE}=${used}; Path=/; Max-Age=${rule.windowSeconds}; HttpOnly; SameSite=Lax${isProduction() ? "; Secure" : ""}`;
      }
    }
    const request = providerRequest(provider as AIProvider, key, model, schema);
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      redirect: "error",
      signal: AbortSignal.timeout(55_000),
      body: JSON.stringify(request.body),
    });
    // Provider bodies can contain credentials or request fragments. They are
    // only inspected to classify the failure, never echoed.
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 4000);
      const failure = classifyProviderFailure(response.status, detail);
      if (failure === "invalid_key")
        return supplied
          ? reply(
              {
                code: "AI_INVALID_KEY",
                message: `Invalid API key for ${config.name}. Check that it is a ${config.name} key (not another provider's), copied in full and still active.`,
              },
              401,
            )
          : reply(
              {
                code: "SERVER_KEY_UNAVAILABLE",
                message:
                  "Free explanations are unavailable right now. Enter your own API key to continue.",
              },
              503,
            );
      if (failure === "rate_limit")
        return reply(
          {
            message: `${config.name} usage or rate limit reached. Check your account quota and try again later.`,
          },
          429,
        );
      if (failure === "model")
        return reply(
          {
            code: "AI_MODEL_REJECTED",
            message: `${config.name} rejected the request or model. Check the model ID and account access (provider HTTP ${response.status}).`,
          },
          502,
        );
    }
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
    return reply(
      { explanation },
      200,
      trialsLeft === null
        ? {}
        : { "X-Free-Explanations-Remaining": String(trialsLeft) },
    );
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
