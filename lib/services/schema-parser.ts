import { Schema } from '@/lib/types/schema';

export async function parseSchema(
  input: string,
  type: 'prisma' | 'sql' | 'connection'
): Promise<Schema> {
  // Mock implementation - returns example schema
  // Structure for future API call: return fetch('/api/parse-schema', ...)
  
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing
  
  // Return a mock schema for demonstration
  return {
    tables: [
      {
        id: 'users',
        name: 'users',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
          { name: 'email', type: 'varchar(255)', nullable: false, unique: true },
          { name: 'name', type: 'varchar(255)', nullable: true },
          { name: 'created_at', type: 'timestamp', nullable: false },
          { name: 'updated_at', type: 'timestamp', nullable: true },
        ],
        description: 'User accounts table',
      },
      {
        id: 'posts',
        name: 'posts',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
          { name: 'title', type: 'varchar(255)', nullable: false },
          { name: 'content', type: 'text', nullable: true },
          { name: 'user_id', type: 'uuid', nullable: false, primaryKey: false, foreignKey: { table: 'users', column: 'id' } },
          { name: 'published', type: 'boolean', nullable: false, defaultValue: 'false' },
          { name: 'created_at', type: 'timestamp', nullable: false },
        ],
        description: 'Blog posts table',
      },
      {
        id: 'comments',
        name: 'comments',
        columns: [
          { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
          { name: 'content', type: 'text', nullable: false },
          { name: 'post_id', type: 'uuid', nullable: false, primaryKey: false, foreignKey: { table: 'posts', column: 'id' } },
          { name: 'user_id', type: 'uuid', nullable: false, primaryKey: false, foreignKey: { table: 'users', column: 'id' } },
          { name: 'created_at', type: 'timestamp', nullable: false },
        ],
        description: 'Comments on posts',
      },
    ],
    relationships: [
      {
        id: 'rel-1',
        from: { table: 'posts', column: 'user_id' },
        to: { table: 'users', column: 'id' },
        type: 'many-to-one',
      },
      {
        id: 'rel-2',
        from: { table: 'comments', column: 'post_id' },
        to: { table: 'posts', column: 'id' },
        type: 'many-to-one',
      },
      {
        id: 'rel-3',
        from: { table: 'comments', column: 'user_id' },
        to: { table: 'users', column: 'id' },
        type: 'many-to-one',
      },
    ],
    metadata: {
      database: 'postgresql',
      version: '1.0.0',
    },
  };
}

