import 'server-only';

import { parsePrismaToSchema } from '@/lib/parsers/prisma-parser';
import { parseSQLToSchema } from '@/lib/parsers/sql-parser';
import { generateDiagram as generateDiagramData } from '@/lib/services/diagram-generator';
import { Schema } from '@/lib/types/schema';

/**
 * API Route Configuration
 * Allow up to 60 seconds for complex schema parsing
 */
export const maxDuration = 60;

/**
 * Detect schema type from content
 * Deterministic detection without AI
 */
function detectSchemaType(schemaContent: string): { type: string; dialect?: string } {
  const content = schemaContent.trim().toLowerCase();

  // Check for SQL patterns FIRST (more explicit patterns)
  if (content.includes('create table') || content.includes('alter table') || content.includes('drop table')) {
    // Detect MySQL-specific syntax
    if (content.includes('auto_increment') || content.includes('engine=')) {
      return { type: 'sql', dialect: 'mysql' };
    }
    // Default to PostgreSQL
    return { type: 'sql', dialect: 'postgresql' };
  }

  // Check for Prisma schema patterns (must have specific Prisma syntax at start of lines)
  // Use regex to check for "model" keyword at the start of a line (after whitespace)
  if (
    /^\s*datasource\s+/m.test(content) ||
    /^\s*generator\s+/m.test(content) ||
    /^\s*model\s+\w+\s*{/m.test(content) ||
    /^\s*enum\s+\w+\s*{/m.test(content)
  ) {
    return { type: 'prisma' };
  }

  // Check for SQLite patterns
  if (content.includes('integer primary key') || content.includes('sqlite')) {
    return { type: 'sql', dialect: 'postgresql' }; // Treat as PostgreSQL for now
  }

  return { type: 'unknown' };
}

/**
 * POST handler for schema visualization API
 * Returns deterministic JSON response with parsed schema and diagram
 */
export async function POST(req: Request) {
  try {
    // Extract input from request
    let schemaContent = '';
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload via FormData
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const textInput = formData.get('text') as string | null;

      if (file) {
        schemaContent = await file.text();
      } else if (textInput) {
        schemaContent = textInput;
      } else {
        return Response.json(
          { error: true, message: 'No schema content provided. Please provide either a file or text input.' },
          { status: 400 }
        );
      }
    } else {
      // Handle JSON input
      const body = await req.json();
      schemaContent = body.schema || body.text || body.content || '';

      if (!schemaContent) {
        return Response.json(
          { error: true, message: 'No schema content provided. Please provide schema text in the request body.' },
          { status: 400 }
        );
      }
    }

    if (!schemaContent.trim()) {
      return Response.json(
        { error: true, message: 'Schema content is empty. Please provide valid schema content.' },
        { status: 400 }
      );
    }

    // Detect schema type deterministically
    const { type, dialect } = detectSchemaType(schemaContent);

    if (type === 'unknown') {
      return Response.json(
        {
          error: true,
          message: 'Unrecognized schema format. Please provide a valid Prisma schema or SQL DDL statements.',
        },
        { status: 400 }
      );
    }

    // Parse schema directly (no AI involved)
    let schema: Schema;
    try {
      if (type === 'prisma') {
        schema = parsePrismaToSchema(schemaContent);
      } else if (type === 'sql') {
        schema = parseSQLToSchema(schemaContent, dialect as 'postgresql' | 'mysql');
      } else {
        throw new Error('Unsupported schema type');
      }
    } catch (parseError) {
      console.error('Schema parsing error:', parseError);
      return Response.json(
        {
          error: true,
          message: parseError instanceof Error ? parseError.message : 'Failed to parse schema. Please check the syntax.',
        },
        { status: 400 }
      );
    }

    // Generate diagram data
    const diagram = generateDiagramData(schema);

    // Return structured JSON response
    return Response.json({
      success: true,
      schema: {
        tables: schema.tables,
        relationships: schema.relationships,
        metadata: schema.metadata,
      },
      diagram: {
        nodes: diagram.nodes,
        edges: diagram.edges,
      },
      summary: `Parsed ${schema.tables.length} tables with ${schema.relationships.length} relationships`,
    });
  } catch (error) {
    console.error('Schema visualization error:', error);
    return Response.json(
      {
        error: true,
        message: error instanceof Error ? error.message : 'Failed to process schema. Please check the syntax and try again.',
      },
      { status: 500 }
    );
  }
}

