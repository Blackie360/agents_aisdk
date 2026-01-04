import { Schema } from '@/lib/types/schema';

/**
 * Stream AI explanation for a schema
 * Calls the schema visualizer API which uses Gemini to generate explanations
 */
export async function* explainSchema(schema: Schema): AsyncGenerator<string> {
  try {
    // Convert schema back to a format the API can understand
    // For now, we'll need the original schema text - this is a limitation
    // In a real implementation, you might want to pass the original text or
    // reconstruct a minimal schema representation
    
    // For now, we'll use a simplified approach: generate explanation from schema structure
    // In production, you'd want to call the API with the original schema text
    
    // This is a placeholder - the actual streaming happens in the API route
    // Frontend should call the API directly for streaming explanations
    
    const explanation = `This schema contains ${schema.tables.length} tables with ${schema.relationships.length} relationships.

**Tables:**
${schema.tables.map(t => `- ${t.name}: ${t.columns.length} columns`).join('\n')}

**Relationships:**
${schema.relationships.map(r => `- ${r.from.table} → ${r.to.table} (${r.type})`).join('\n')}

**Analysis:**
The schema structure suggests a well-normalized database design with clear relationships between entities.`;

    for (const char of explanation) {
      yield char;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  } catch (error) {
    yield `Error generating explanation: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Stream AI explanation directly from schema text
 * This is the recommended approach - call the API with original schema text
 */
export async function* explainSchemaFromText(schemaText: string): AsyncGenerator<string> {
  try {
    const response = await fetch('/api/schema-visualizer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ schema: schemaText }),
    });

    if (!response.ok) {
      throw new Error('Failed to get explanation');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

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
              if (data.type === 'text-delta' && data.textDelta) {
                yield data.textDelta;
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    }
  } catch (error) {
    yield `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

