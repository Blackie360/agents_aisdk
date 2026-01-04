import { Schema } from '@/lib/types/schema';

/**
 * Parse schema using the AI agent API
 * Automatically detects schema type and parses it
 * 
 * Note: This function calls the API route which uses AI agent tools.
 * For direct parsing without AI, use the parser utilities directly.
 */
export async function parseSchema(
  input: string,
  type: 'prisma' | 'sql' | 'connection'
): Promise<Schema> {
  try {
    // Call the schema visualizer API
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

    // Parse the streaming response
    // The API returns a data stream, so we need to extract the final result
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let lastResult: any = null;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const data = JSON.parse(line.slice(2));
              if (data.type === 'tool-call-result' && data.result) {
                lastResult = data.result;
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    }

    // Extract schema from the result
    if (lastResult?.result?.schema) {
      return lastResult.result.schema as Schema;
    }

    // Fallback: try to parse from tool results
    // This is a simplified extraction - in production, you'd want more robust parsing
    throw new Error('Could not extract schema from API response');
  } catch (error) {
    // Fallback to direct parsing if API fails
    if (type === 'prisma') {
      const { parsePrismaToSchema } = await import('@/lib/parsers/prisma-parser');
      return parsePrismaToSchema(input);
    } else if (type === 'sql') {
      const { parseSQLToSchema } = await import('@/lib/parsers/sql-parser');
      return parseSQLToSchema(input);
    }
    
    throw error instanceof Error ? error : new Error('Failed to parse schema');
  }
}

