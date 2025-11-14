import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { geminiModel } from "./index";

/**
 * Generate text with Google Search capabilities and access to provider metadata.
 * This is useful for non-streaming use cases where you need grounding metadata
 * and safety ratings from Google's Gemini API.
 *
 * @example
 * ```typescript
 * const result = await generateTextWithGoogleSearch({
 *   prompt: "List the top 5 San Francisco news from the past week.",
 * });
 *
 * // Access grounding metadata
 * // The providerMetadata type structure may vary - access it safely
 * const metadata = result.providerMetadata?.google;
 * const groundingMetadata = metadata?.groundingMetadata;
 * const safetyRatings = metadata?.safetyRatings;
 * ```
 */
export async function generateTextWithGoogleSearch({
  prompt,
  system,
}: {
  prompt: string;
  system?: string;
}) {
  const result = await generateText({
    model: geminiModel as any,
    tools: {
      google_search: (google as any).tools.googleSearch({}),
    },
    system,
    prompt,
  });

  // Access the grounding metadata from providerMetadata
  // The structure matches the example pattern from the user's request
  const metadata = result.providerMetadata?.google as
    | {
        groundingMetadata?: any;
        safetyRatings?: any;
      }
    | undefined;

  const groundingMetadata = metadata?.groundingMetadata;
  const safetyRatings = metadata?.safetyRatings;

  return {
    ...result,
    groundingMetadata,
    safetyRatings,
  };
}
