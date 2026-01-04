import { getSchema, Model, Field, Attribute } from '@mrleebo/prisma-ast';
import { Schema, Table, Column, Relationship } from '@/lib/types/schema';
import { nanoid } from 'nanoid';

/**
 * Parse Prisma schema content into structured Schema format
 * Extracts models, fields, relations, and constraints
 */
export function parsePrismaToSchema(content: string): Schema {
  try {
    const ast = getSchema(content);
    const tables: Table[] = [];
    const relationships: Relationship[] = [];
    const relationMap = new Map<string, { field: string; target: string; relationName?: string }[]>();

    // First pass: Extract all models and their fields
    ast.list.forEach((item) => {
      if (item.type === 'model') {
        const model = item as Model;
        const columns: Column[] = [];
        const modelRelations: { field: string; target: string; relationName?: string }[] = [];

        model.properties.forEach((prop) => {
          if (prop.type === 'field') {
            const field = prop as Field;
            const column: Column = {
              name: field.name,
              type: extractFieldType(field),
              nullable: field.optional || false,
              primaryKey: false,
              unique: false,
              defaultValue: extractDefaultValue(field),
            };

            // Check for attributes (primary key, unique, etc.)
            field.attributes?.forEach((attr) => {
              if (attr.name === 'id' || attr.name === '@id') {
                column.primaryKey = true;
              }
              if (attr.name === 'unique' || attr.name === '@unique') {
                column.unique = true;
              }
              if (attr.name === 'index' || attr.name === '@index') {
                column.indexed = true;
              }
              if (attr.name === 'relation' || attr.name === '@relation') {
                // Extract relation information
                const relationName = attr.args?.find((arg: any) => arg.name === 'name')?.value as string;
                const fields = attr.args?.find((arg: any) => arg.name === 'fields')?.value as string[];
                const references = attr.args?.find((arg: any) => arg.name === 'references')?.value as string[];
                
                if (fields && references && references.length > 0) {
                  // This is a foreign key relation
                  const targetModel = findModelByField(ast, references[0]);
                  if (targetModel) {
                    column.foreignKey = {
                      table: targetModel,
                      column: references[0],
                    };
                    modelRelations.push({
                      field: fields[0],
                      target: targetModel,
                      relationName,
                    });
                  }
                }
              }
            });

            columns.push(column);
          }
        });

        tables.push({
          id: model.name,
          name: model.name,
          columns,
        });

        // Store relations for second pass
        if (modelRelations.length > 0) {
          relationMap.set(model.name, modelRelations);
        }
      }
    });

    // Second pass: Build relationships
    relationMap.forEach((relations, sourceModel) => {
      relations.forEach((rel) => {
        // Find the reverse relation
        const targetModel = ast.list.find(
          (item) => item.type === 'model' && (item as Model).name === rel.target
        ) as Model | undefined;

        if (targetModel) {
          // Determine relationship type
          const relationType = determineRelationType(tables, sourceModel, rel.target, rel.field);
          
          relationships.push({
            id: nanoid(),
            from: { table: sourceModel, column: rel.field },
            to: { table: rel.target, column: rel.field },
            type: relationType,
          });
        }
      });
    });

    return {
      tables,
      relationships,
      metadata: {
        database: 'prisma',
        version: '1.0.0',
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse Prisma schema: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract field type from Prisma field definition
 */
function extractFieldType(field: Field): string {
  if (typeof field.fieldType === 'string') {
    return field.fieldType;
  }
  // Handle array types
  if (Array.isArray(field.fieldType)) {
    return field.fieldType.join('[]');
  }
  return 'unknown';
}

/**
 * Extract default value from field attributes
 */
function extractDefaultValue(field: Field): string | undefined {
  const defaultAttr = field.attributes?.find((attr) => attr.name === 'default' || attr.name === '@default');
  if (defaultAttr) {
    const value = defaultAttr.args?.[0]?.value;
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object' && 'name' in value) {
      return (value as any).name; // Handle function calls like now(), uuid(), etc.
    }
  }
  return undefined;
}

/**
 * Find model name that contains a specific field
 */
function findModelByField(ast: any, fieldName: string): string | null {
  for (const item of ast.list) {
    if (item.type === 'model') {
      const model = item as Model;
      const hasField = model.properties.some(
        (prop) => prop.type === 'field' && (prop as Field).name === fieldName
      );
      if (hasField) {
        return model.name;
      }
    }
  }
  return null;
}

/**
 * Determine relationship type based on schema structure
 */
function determineRelationType(
  tables: Table[],
  sourceTable: string,
  targetTable: string,
  field: string
): 'one-to-one' | 'one-to-many' | 'many-to-many' {
  const source = tables.find((t) => t.name === sourceTable);
  const target = tables.find((t) => t.name === targetTable);
  
  if (!source || !target) {
    return 'one-to-many'; // Default
  }

  const sourceField = source.columns.find((c) => c.name === field);
  const targetField = target.columns.find((c) => c.name === field);

  // If both sides have unique constraints, it's one-to-one
  if (sourceField?.unique && targetField?.unique) {
    return 'one-to-one';
  }

  // If source is unique but target is not, it's one-to-many
  if (sourceField?.unique && !targetField?.unique) {
    return 'one-to-many';
  }

  // Default to one-to-many
  return 'one-to-many';
}

