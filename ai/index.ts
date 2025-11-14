import { google } from "@ai-sdk/google";
import { gateway } from "@ai-sdk/gateway";
import { createGateway } from "ai";

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

// Create gateway instance with API key if using gateway
// According to Vercel AI SDK docs, gateway() uses AI_GATEWAY_API_KEY env var by default
// But we can also use createGateway() for explicit API key configuration
const gatewayInstance = gatewayApiKey
  ? createGateway({ apiKey: gatewayApiKey })
  : gateway;

// Primary language model - Gemini 2.5 Flash
// Supports Google Search, code execution, and grounding
export const geminiModel = useDirectGoogle
  ? google("gemini-2.5-flash")
  : gatewayInstance("google/gemini-2.5-flash");

// Image generation model - Gemini 2.5 Flash with image generation
export const geminiImageModel = useDirectGoogle
  ? google("gemini-2.5-flash-image-preview")
  : gatewayInstance("google/gemini-2.5-flash-image-preview");

// Embedding model for semantic search and similarity
export const embeddingModel = useDirectGoogle
  ? google("gemini-embedding-001")
  : gatewayInstance("google/gemini-embedding-001");

// Export the google instance for tool access
export { google };
