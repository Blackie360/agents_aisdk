import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

config({
  path: ".env.local",
});

async function checkEmbeddingsTable() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL or POSTGRES_URL must be defined");
  }

  const connection = postgres(dbUrl, {
    max: 1,
    ssl: "require",
    connect_timeout: 60,
  });
  const db = drizzle(connection);

  try {
    // Check if the table exists
    const result = await db.execute(
      sql`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'WorkspaceFileEmbedding'
      );`
    );

    const tableExists = result[0]?.exists;
    
    if (tableExists) {
      console.log("✅ WorkspaceFileEmbedding table exists!");
      
      // Count embeddings
      const countResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM "WorkspaceFileEmbedding";`
      );
      const count = countResult[0]?.count || 0;
      console.log(`📊 Total embeddings in database: ${count}`);
      
      // Show sample embeddings
      const sampleResult = await db.execute(
        sql`SELECT id, "workspaceId", "chunkIndex", LEFT(content, 50) as content_preview 
            FROM "WorkspaceFileEmbedding" 
            LIMIT 5;`
      );
      
      if (sampleResult.length > 0) {
        console.log("\n📝 Sample embeddings:");
        sampleResult.forEach((row: any) => {
          console.log(`  - Chunk ${row.chunkIndex}: ${row.content_preview}...`);
        });
      }
    } else {
      console.log("❌ WorkspaceFileEmbedding table does NOT exist!");
      console.log("\n⚠️  You need to run the database migration:");
      console.log("   npm run db:migrate");
      console.log("\n   Or if using drizzle-kit:");
      console.log("   npx drizzle-kit generate");
      console.log("   npx drizzle-kit migrate");
    }
  } catch (error) {
    console.error("❌ Error checking table:", error);
  } finally {
    await connection.end();
  }
}

checkEmbeddingsTable();

