import { streamText, tool } from 'ai';
import { geminiModel } from '@/ai';
import { z } from 'zod';
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
 * Analyzes the input to determine if it's Prisma, PostgreSQL, MySQL, etc.
 */
const detectSchemaType = tool({
  description: 'Automatically detect the type of database schema from content. Analyze keywords and patterns to determine if it is Prisma, PostgreSQL, MySQL, SQLite, or unknown.',
  parameters: z.object({
    schemaContent: z.string().describe('The schema text to analyze'),
  }),
  execute: async ({ schemaContent }: { schemaContent: string }) => {
    const content = schemaContent.trim().toLowerCase();

    // Check for Prisma schema patterns
    if (content.includes('datasource') || content.includes('model ') || content.includes('enum ')) {
      return { type: 'prisma', confidence: 'high' };
    }

    // Check for SQL patterns
    if (content.includes('create table') || content.includes('alter table')) {
      // Detect PostgreSQL-specific syntax
      if (content.includes('serial') || content.includes('uuid') || content.includes('text[]')) {
        return { type: 'postgresql', confidence: 'high' };
      }
      // Detect MySQL-specific syntax
      if (content.includes('auto_increment') || content.includes('engine=')) {
        return { type: 'mysql', confidence: 'high' };
      }
      // Generic SQL
      return { type: 'postgresql', confidence: 'medium' }; // Default to PostgreSQL
    }

    // Check for SQLite patterns
    if (content.includes('integer primary key') || content.includes('sqlite')) {
      return { type: 'sqlite', confidence: 'medium' };
    }

    return { type: 'unknown', confidence: 'low' };
  },
});

/**
 * Parse Prisma schema into structured format
 * Extracts models, fields, relations, and constraints
 */
const parsePrismaSchema = tool({
  description: 'Parse Prisma schema content into structured format with tables, columns, relationships, and constraints. Returns a complete schema object.',
  parameters: z.object({
    schemaContent: z.string().describe('Prisma schema content to parse'),
  }),
  execute: async ({ schemaContent }: { schemaContent: string }) => {
    try {
      const schema = parsePrismaToSchema(schemaContent);
      return {
        success: true,
        schema: {
          tables: schema.tables,
          relationships: schema.relationships,
          metadata: schema.metadata,
        },
        summary: `Parsed ${schema.tables.length} tables with ${schema.relationships.length} relationships`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

/**
 * Parse SQL schema into structured format
 * Supports PostgreSQL and MySQL dialects
 */
const parseSQLSchema = tool({
  description: 'Parse SQL schema (PostgreSQL or MySQL) into structured format with tables, columns, constraints, foreign keys, and indexes.',
  parameters: z.object({
    schemaContent: z.string().describe('SQL schema content to parse'),
    dialect: z.enum(['postgresql', 'mysql']).default('postgresql').describe('SQL dialect (postgresql or mysql)'),
  }),
  execute: async ({ schemaContent, dialect }: { schemaContent: string; dialect: 'postgresql' | 'mysql' }) => {
    try {
      const schema = parseSQLToSchema(schemaContent, dialect);
      return {
        success: true,
        schema: {
          tables: schema.tables,
          relationships: schema.relationships,
          metadata: schema.metadata,
        },
        summary: `Parsed ${schema.tables.length} tables with ${schema.relationships.length} relationships`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

/**
 * Generate ER diagram nodes and edges from parsed schema
 * Creates visualization data with auto-layout positioning
 */
const generateDiagram = tool({
  description: 'Generate ER diagram nodes and edges from parsed schema. Calculates positions for tables and creates edges for relationships.',
  parameters: z.object({
    schema: z.object({
      tables: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          columns: z.array(z.any()),
        })
      ),
      relationships: z.array(
        z.object({
          id: z.string(),
          from: z.object({ table: z.string(), column: z.string() }),
          to: z.object({ table: z.string(), column: z.string() }),
          type: z.string(),
        })
      ),
      metadata: z.object({ database: z.string().optional(), version: z.string().optional() }).optional(),
    }).describe('Parsed schema structure'),
  }),
  execute: async ({ schema }: { schema: any }) => {
    try {
      const schemaObj: Schema = {
        tables: schema.tables.map((t) => ({
          id: t.id,
          name: t.name,
          columns: t.columns,
        })),
        relationships: schema.relationships.map((r) => ({
          id: r.id,
          from: r.from,
          to: r.to,
          type: r.type as 'one-to-one' | 'one-to-many' | 'many-to-many',
        })),
        metadata: schema.metadata,
      };

      const diagram = generateDiagramData(schemaObj);
      return {
        success: true,
        diagram: {
          nodes: diagram.nodes,
          edges: diagram.edges,
        },
        summary: `Generated diagram with ${diagram.nodes.length} nodes and ${diagram.edges.length} edges`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

/**
 * Format final response with schema, diagram, and summary
 * Combines all parsed data into a complete response
 */
const formatFinalResponse = tool({
  description: 'Format the final structured response with schema, diagram, and summary. This is the last step before returning results to the user.',
  parameters: z.object({
    schema: z.any().describe('Parsed schema object'),
    diagram: z.any().describe('Generated diagram with nodes and edges'),
    summary: z.string().optional().describe('Summary of the analysis'),
  }),
  execute: async ({ schema, diagram, summary }: { schema: any; diagram: any; summary?: string }) => {
    return {
      success: true,
      result: {
        schema: {
          tables: schema.tables || [],
          relationships: schema.relationships || [],
          metadata: schema.metadata,
        },
        diagram: {
          nodes: diagram.nodes || [],
          edges: diagram.edges || [],
        },
        summary: summary || `Analyzed ${schema.tables?.length || 0} tables with ${schema.relationships?.length || 0} relationships`,
      },
    };
  },
});

/**
 * POST handler for schema visualization API
 * Accepts FormData (file upload) or JSON (text input)
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

    // Create AI agent with tools
    const result = await streamText({
      model: geminiModel as any,
      system: `You are an expert database schema analyzer. Your task is to:
1. Detect the schema type (Prisma, PostgreSQL, MySQL, etc.) using detectSchemaType
2. Parse the schema using the appropriate parser (parsePrismaSchema or parseSQLSchema)
3. Generate a diagram visualization using generateDiagram
4. Format the final response using formatFinalResponse
5. Provide a natural language explanation of the schema structure, relationships, and design patterns

Always use the tools in sequence. If parsing fails, explain the error clearly.`,
      prompt: `Analyze this database schema and generate a complete visualization:

\`\`\`
${schemaContent}
\`\`\`

Please:
1. Detect the schema type
2. Parse it into structured format
3. Generate diagram data
4. Format the complete response
5. Explain the schema structure, relationships, and any notable design patterns`,
      tools: {
        detectSchemaType,
        parsePrismaSchema,
        parseSQLSchema,
        generateDiagram,
        formatFinalResponse,
      },
      maxToolRoundtrips: 15, // Allow multiple tool calls
    });

    // Return streaming response
    return result.toTextStreamResponse();
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

