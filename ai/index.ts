import { google } from "@ai-sdk/google";

// Note: Middleware removed temporarily as wrapLanguageModel expects LanguageModelV2
// but google() returns LanguageModelV1. We can add middleware back when provider is updated.
export const geminiProModel = google("gemini-2.5-pro");

export const geminiFlashModel = google("gemini-2.5-flash");
