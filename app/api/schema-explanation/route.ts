import 'server-only';

import { streamText } from 'ai';
import { geminiModel } from '@/ai';
import { Schema } from '@/lib/types/schema';

/**
 * API Route Configuration
 * Allow up to 60 seconds for AI explanation generation
 */
export const maxDuration = 60;

/**
 * POST handler for streaming AI schema explanations
 * Accepts a parsed schema object and streams back natural language explanation
 */
export async function POST(req: Request) {
  try {
    const { schema } = await req.json();

    if (!schema || !schema.tables) {
      return Response.json(
        { error: true, message: 'Invalid schema provided. Please provide a valid schema object.' },
        { status: 400 }
      );
    }

    const typedSchema = schema as Schema;

    // Generate detailed prompt for AI explanation
    const tablesDescription = typedSchema.tables
      .map(
        (t) =>
          `- **${t.name}**: ${t.columns.length} columns
  ${t.columns
    .map(
      (c) =>
        `  - ${c.name}: ${c.type}${c.primaryKey ? ' (PK)' : ''}${c.foreignKey ? ` (FK → ${c.foreignKey.table}.${c.foreignKey.column})` : ''}${!c.nullable ? ' NOT NULL' : ''}`
    )
    .join('\n')}`
      )
      .join('\n\n');

    const relationshipsDescription =
      typedSchema.relationships.length > 0
        ? typedSchema.relationships
            .map(
              (r) =>
                `- ${r.from.table}.${r.from.column} → ${r.to.table}.${r.to.column} (${r.type})`
            )
            .join('\n')
        : 'No explicit relationships defined.';

    // Stream AI explanation
    const result = await streamText({
      model: geminiModel as any,
      system: `You are an expert database architect with deep knowledge of schema design patterns, normalization, and best practices. 

When analyzing a database schema, provide:
1. **Overview**: High-level purpose and structure
2. **Table Analysis**: Purpose and role of each table
3. **Relationships**: How tables connect and interact
4. **Design Patterns**: Identified patterns (e.g., inheritance, junction tables, soft deletes)
5. **Strengths**: What's done well in the design
6. **Potential Improvements**: Suggestions for optimization or better practices

Use clear, professional language. Format with markdown for readability.`,
      prompt: `Analyze this database schema and provide a comprehensive explanation:

## Schema Structure

### Tables (${typedSchema.tables.length})
${tablesDescription}

### Relationships (${typedSchema.relationships.length})
${relationshipsDescription}

${typedSchema.metadata?.database ? `### Database
Type: ${typedSchema.metadata.database}
${typedSchema.metadata.version ? `Version: ${typedSchema.metadata.version}` : ''}` : ''}

Please provide a thorough analysis of this schema, covering its structure, relationships, design patterns, and any recommendations for improvement.`,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Schema explanation error:', error);
    return Response.json(
      {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to generate explanation. Please try again.',
      },
      { status: 500 }
    );
  }
}

