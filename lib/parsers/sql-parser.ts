import { parse } from 'pgsql-ast-parser';
import { Schema, Table, Column, Relationship } from '@/lib/types/schema';
import { nanoid } from 'nanoid';

/**
 * Parse SQL schema (PostgreSQL) into structured Schema format
 * Extracts tables, columns, constraints, foreign keys, and indexes
 */
export function parseSQLToSchema(content: string, dialect: 'postgresql' | 'mysql' = 'postgresql'): Schema {
  try {
    const statements = parse(content);
    const tables: Table[] = [];
    const relationships: Relationship[] = [];
    const tableMap = new Map<string, Table>();

    statements.forEach((stmt: any) => {
      if (stmt.type === 'create table') {
        const createTable = stmt;
        const tableName = createTable.name?.name || '';
        const columns: Column[] = [];
        const foreignKeys: { column: string; targetTable: string; targetColumn: string }[] = [];

        createTable.columns?.forEach((colDef: any) => {
          if (colDef.kind === 'column') {
            const col = colDef;
            const column: Column = {
              name: col.name?.name || '',
              type: extractSQLType(col),
              nullable: !col.notNull,
              primaryKey: false,
              unique: false,
              defaultValue: extractSQLDefault(col),
            };

            // Check constraints
            col.constraints?.forEach((constraint: any) => {
              if (constraint.type === 'primary key') {
                column.primaryKey = true;
              }
              if (constraint.type === 'unique') {
                column.unique = true;
              }
              // Handle both 'foreign key' (table-level) and 'reference' (inline) constraints
              if (constraint.type === 'foreign key' || constraint.type === 'reference') {
                const fk = constraint as any;
                // For inline REFERENCES (type='reference')
                if (fk.foreignTable?.name && fk.foreignColumns?.[0]?.name) {
                  column.foreignKey = {
                    table: fk.foreignTable.name,
                    column: fk.foreignColumns[0].name,
                  };
                  foreignKeys.push({
                    column: col.name?.name || '',
                    targetTable: fk.foreignTable.name,
                    targetColumn: fk.foreignColumns[0].name,
                  });
                }
                // For table-level FOREIGN KEY constraints
                else if (fk.references?.table?.name && fk.references?.columns?.[0]?.name) {
                  column.foreignKey = {
                    table: fk.references.table.name,
                    column: fk.references.columns[0].name,
                  };
                  foreignKeys.push({
                    column: col.name?.name || '',
                    targetTable: fk.references.table.name,
                    targetColumn: fk.references.columns[0].name,
                  });
                }
              }
            });

            // Check for indexes in table constraints
            createTable.constraints?.forEach((constraint: any) => {
              if (constraint.type === 'primary key') {
                const pk = constraint as any;
                if (pk.columns?.some((c: any) => c.name === (col.name?.name || ''))) {
                  column.primaryKey = true;
                }
              }
              if (constraint.type === 'unique') {
                const uq = constraint as any;
                if (uq.columns?.some((c: any) => c.name === (col.name?.name || ''))) {
                  column.unique = true;
                }
              }
              // Handle both 'foreign key' (table-level) and 'reference' (inline) constraints
              if (constraint.type === 'foreign key' || constraint.type === 'reference') {
                const fk = constraint as any;
                const columnMatches = fk.columns?.some((c: any) => c.name === (col.name?.name || ''));
                
                if (columnMatches) {
                  // For inline REFERENCES (type='reference')
                  if (fk.foreignTable?.name && fk.foreignColumns?.[0]?.name) {
                    column.foreignKey = {
                      table: fk.foreignTable.name,
                      column: fk.foreignColumns[0].name,
                    };
                    foreignKeys.push({
                      column: col.name?.name || '',
                      targetTable: fk.foreignTable.name,
                      targetColumn: fk.foreignColumns[0].name,
                    });
                  }
                  // For table-level FOREIGN KEY constraints
                  else if (fk.references?.table?.name && fk.references?.columns?.[0]?.name) {
                    column.foreignKey = {
                      table: fk.references?.table?.name || '',
                      column: fk.references?.columns?.[0]?.name || '',
                    };
                    foreignKeys.push({
                      column: col.name?.name || '',
                      targetTable: fk.references.table.name,
                      targetColumn: fk.references.columns[0].name,
                    });
                  }
                }
              }
            });

            columns.push(column);
          }
        });

        const table: Table = {
          id: tableName,
          name: tableName,
          columns,
        };

        tables.push(table);
        tableMap.set(tableName, table);

        // Create relationships from foreign keys
        foreignKeys.forEach((fk) => {
          relationships.push({
            id: nanoid(),
            from: { table: tableName, column: fk.column },
            to: { table: fk.targetTable, column: fk.targetColumn },
            type: determineSQLRelationType(tableMap, tableName, fk.targetTable, fk.column),
          });
        });
      }
    });

    return {
      tables,
      relationships,
      metadata: {
        database: dialect,
        version: '1.0.0',
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse SQL schema: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract SQL column type
 */
function extractSQLType(col: any): string {
  if (col.dataType?.name) {
    const name = col.dataType.name;
    const config = col.dataType.config;
    if (config && config.length > 0) {
      return `${name}(${config.map((a: any) => a).join(', ')})`;
    }
    return name;
  }
  return 'unknown';
}

/**
 * Extract default value from SQL column
 */
function extractSQLDefault(col: any): string | undefined {
  if (col.default) {
    if (typeof col.default === 'string') {
      return col.default;
    }
    if (col.default.type === 'string') {
      return (col.default as any).value;
    }
    if (col.default.type === 'function') {
      return (col.default as any).name + '()';
    }
  }
  return undefined;
}

/**
 * Determine relationship type for SQL foreign keys
 */
function determineSQLRelationType(
  tableMap: Map<string, Table>,
  sourceTable: string,
  targetTable: string,
  field: string
): 'one-to-one' | 'one-to-many' | 'many-to-many' {
  const source = tableMap.get(sourceTable);
  const target = tableMap.get(targetTable);

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

  // Default to one-to-many (most common)
  return 'one-to-many';
}

