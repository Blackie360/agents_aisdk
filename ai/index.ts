import { gateway } from "@ai-sdk/gateway";

// Vercel AI Gateway Configuration - REQUIRED
// Gateway wrapper expects AI_GATEWAY_API_KEY, but we support both for compatibility
const gatewayApiKey =
  process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_AI_GATEWAY_API_KEY;

if (!gatewayApiKey) {
  throw new Error(
    "AI_GATEWAY_API_KEY or VERCEL_AI_GATEWAY_API_KEY is required. Please set it in your .env.local file.",
  );
}

// Configure gateway with API key
// The gateway() function automatically routes through Vercel AI Gateway
// Format: gateway('provider/model-name', { apiKey })
const gatewayConfig = {
  apiKey: gatewayApiKey,
};

// Primary language model - Gemini 2.5 Flash (supports all features)
// Uses Vercel AI Gateway exclusively via gateway wrapper
// Format: gateway('google/model-name') routes to Google through Vercel AI Gateway
export const geminiModel = gateway("google/gemini-2.5-flash", gatewayConfig);

// Image generation model - Gemini 2.5 Flash with image generation capability
// Uses Vercel AI Gateway exclusively via gateway wrapper
export const geminiImageModel = gateway(
  "google/gemini-2.5-flash-image-preview",
  gatewayConfig,
);

// Embedding model for semantic search and similarity
// Uses Vercel AI Gateway exclusively via gateway wrapper
export const embeddingModel = gateway(
  "google/gemini-embedding-001",
  gatewayConfig,
);

// Export gateway function for tools
// Tools will use the gateway through the model configuration in streamText
export const gatewayWithConfig = (model: string) =>
  gateway(`google/${model}`, gatewayConfig);
