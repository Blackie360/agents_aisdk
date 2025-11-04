import { google } from "@ai-sdk/google";

// @ai-sdk/google v2.0+ provides LanguageModelV2 support for AI SDK v5
export const geminiProModel = google("gemini-2.5-pro");

export const geminiFlashModel = google("gemini-2.5-flash");
