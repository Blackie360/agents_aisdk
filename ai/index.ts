import { google } from "@ai-sdk/google";
import { gateway } from "@ai-sdk/gateway";

// Check for API keys - support both direct Google API key and Gateway
const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const gatewayApiKey =
  process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_AI_GATEWAY_API_KEY;

// Use direct Google SDK if GOOGLE_GENERATIVE_AI_API_KEY is set
// Otherwise fall back to Vercel AI Gateway
const useDirectGoogle = !!googleApiKey;

if (!googleApiKey && !gatewayApiKey) {
  throw new Error(
    "Either GOOGLE_GENERATIVE_AI_API_KEY or AI_GATEWAY_API_KEY/VERCEL_AI_GATEWAY_API_KEY is required. Please set one in your .env.local file.",
  );
}

// Primary language model - Gemini 2.5 Flash
// Supports Google Search, code execution, and grounding
export const geminiModel = useDirectGoogle
  ? google("gemini-2.5-flash")
  : gateway("google/gemini-2.5-flash", { apiKey: gatewayApiKey });

// Image generation model - Gemini 2.5 Flash with image generation
export const geminiImageModel = useDirectGoogle
  ? google("gemini-2.5-flash-image-preview")
  : gateway("google/gemini-2.5-flash-image-preview", { apiKey: gatewayApiKey });

// Embedding model for semantic search and similarity
export const embeddingModel = useDirectGoogle
  ? google("gemini-embedding-001")
  : gateway("google/gemini-embedding-001", { apiKey: gatewayApiKey });

// Export the google instance for tool access
export { google };
