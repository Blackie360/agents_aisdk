import { google } from "@ai-sdk/google";
import { gateway } from "ai";

// Use Vercel AI Gateway to handle rate limiting for Google Generative API
// The gateway automatically handles rate limits, retries, and provides better reliability
// You can use either the gateway provider or direct model strings
// For Google models, use the format: 'google/model-name'

// Option 1: Use gateway provider instance (recommended for better control)
export const geminiProModel = gateway("google/gemini-2.5-pro");

export const geminiFlashModel = gateway("google/gemini-2.5-flash");

// Option 2: Fallback to direct Google provider if gateway is not configured
// Uncomment these if you want to use direct Google API without gateway
// export const geminiProModel = google("gemini-2.5-pro");
// export const geminiFlashModel = google("gemini-2.5-flash");
