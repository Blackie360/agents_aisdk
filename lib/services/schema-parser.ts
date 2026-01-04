import { Schema } from '@/lib/types/schema';

export interface SchemaParseResult {
  schema: Schema;
  explanation: string;
}

/**
 * Parse schema using deterministic parsing (no AI involved)
 * Optionally streams AI explanation in parallel via separate endpoint
 * 
 * This approach is more reliable than relying on AI for parsing:
 * - Schema parsing happens immediately and deterministically
 * - AI explanation is optional and streams separately
 * - Similar to how Supabase handles schema visualization
 */
export async function parseSchemaWithExplanation(
  input: string,
  type: 'prisma' | 'sql' | 'connection',
  onExplanationChunk?: (chunk: string) => void
): Promise<Schema> {
  try {
    // Step 1: Parse schema deterministically (fast, reliable)
    const response = await fetch('/api/schema-visualizer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schema: input,
        text: input,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to parse schema');
    }

    // Parse JSON response
    const result = await response.json();

    if (!result.success || !result.schema) {
      throw new Error(result.message || 'Invalid response from API');
    }

    const schema = result.schema as Schema;

    // Step 2: Stream AI explanation in parallel (optional, non-blocking)
    if (onExplanationChunk) {
      // Fire and forget - don't await, let it stream in background
      streamExplanation(schema, onExplanationChunk).catch((error) => {
        console.error('Failed to stream explanation:', error);
        onExplanationChunk(
          '\n\n_Note: AI explanation failed to generate. The schema has been parsed successfully._'
        );
      });
    }

    return schema;
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error('Failed to parse schema. Please ensure the API route is working correctly.');
  }
}

/**
 * Stream AI explanation for a parsed schema
 * Calls the separate explanation endpoint
 */
async function streamExplanation(
  schema: Schema,
  onChunk: (chunk: string) => void
): Promise<void> {
  const response = await fetch('/api/schema-explanation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ schema }),
  });

  if (!response.ok) {
    throw new Error('Failed to get explanation');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        // AI SDK stream format: lines are formatted as "index:json"
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const jsonStr = line.slice(colonIndex + 1);

        try {
          const data = JSON.parse(jsonStr);

          // Extract text deltas for explanation
          if (data.type === 'text-delta' && data.textDelta) {
            onChunk(data.textDelta);
          }
        } catch (e) {
          // Skip invalid JSON lines - they might be partial chunks
        }
      }
    }
  }
}

/**
 * Parse schema without explanation streaming
 * Use parseSchemaWithExplanation if you want to stream the AI explanation
 */
export async function parseSchema(
  input: string,
  type: 'prisma' | 'sql' | 'connection'
): Promise<Schema> {
  return parseSchemaWithExplanation(input, type);
}

