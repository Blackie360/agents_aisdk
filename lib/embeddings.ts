import "server-only";
import { embedMany } from "ai";
import { embeddingModel } from "@/ai";
import Papa from "papaparse";

const CHUNK_SIZE = 1000; // Characters per chunk
const CHUNK_OVERLAP = 200; // Overlap between chunks

/**
 * Extract text content from a CSV file
 */
export async function extractTextFromCSV(fileContent: string): Promise<Array<{ content: string; metadata?: any }>> {
  const parseResult = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true,
  });

  if (parseResult.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${parseResult.errors.map(e => e.message).join(", ")}`);
  }

  const chunks: Array<{ content: string; metadata?: any }> = [];
  
  // Add header information as first chunk
  if (parseResult.meta.fields && parseResult.meta.fields.length > 0) {
    chunks.push({
      content: `CSV File Structure:\nColumns: ${parseResult.meta.fields.join(", ")}\n\nThis CSV contains ${parseResult.data.length} rows of data.`,
      metadata: { type: "header", columns: parseResult.meta.fields },
    });
  }

  // Process rows in batches
  const rowsPerChunk = 10; // Group rows together
  for (let i = 0; i < parseResult.data.length; i += rowsPerChunk) {
    const batch = parseResult.data.slice(i, i + rowsPerChunk);
    const rowTexts = batch.map((row, idx) => {
      const rowNum = i + idx + 1;
      const values = Object.entries(row)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
      return `Row ${rowNum}: ${values}`;
    });
    
    chunks.push({
      content: rowTexts.join("\n"),
      metadata: { 
        type: "data", 
        startRow: i + 1, 
        endRow: Math.min(i + rowsPerChunk, parseResult.data.length),
        columns: parseResult.meta.fields,
      },
    });
  }

  return chunks;
}

/**
 * Extract text from a text file
 */
export async function extractTextFromTextFile(fileContent: string): Promise<Array<{ content: string; metadata?: any }>> {
  // Split into chunks with overlap
  const chunks: Array<{ content: string; metadata?: any }> = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < fileContent.length) {
    const end = Math.min(start + CHUNK_SIZE, fileContent.length);
    const chunk = fileContent.slice(start, end);
    
    chunks.push({
      content: chunk,
      metadata: { 
        type: "text",
        chunkIndex,
        startChar: start,
        endChar: end,
      },
    });

    start = end - CHUNK_OVERLAP; // Overlap for context
    chunkIndex++;
  }

  return chunks;
}

/**
 * Extract text from a file based on its type
 */
export async function extractTextFromFile(
  fileContent: string,
  fileName: string,
  mimeType?: string,
): Promise<Array<{ content: string; metadata?: any }>> {
  const lowerFileName = fileName.toLowerCase();
  
  if (lowerFileName.endsWith(".csv") || mimeType === "text/csv" || mimeType === "application/vnd.ms-excel") {
    return extractTextFromCSV(fileContent);
  }
  
  // Default to text extraction
  return extractTextFromTextFile(fileContent);
}

/**
 * Generate embeddings for text chunks
 */
export async function generateEmbeddings(
  chunks: Array<{ content: string; metadata?: any }>,
): Promise<Array<{ embedding: number[]; content: string; metadata?: any }>> {
  if (chunks.length === 0) {
    return [];
  }

  const texts = chunks.map(chunk => chunk.content);
  
  try {
    console.log(`[Embeddings] Generating embeddings for ${texts.length} chunks...`);
    
    const result = await embedMany({
      model: embeddingModel,
      values: texts,
    });

    if (!result.embeddings || result.embeddings.length !== texts.length) {
      throw new Error(`Expected ${texts.length} embeddings, got ${result.embeddings?.length || 0}`);
    }

    const embeddings = result.embeddings.map((emb: any) => {
      // Handle different response formats
      if (Array.isArray(emb)) {
        return emb;
      }
      if (emb && Array.isArray(emb.embedding)) {
        return emb.embedding;
      }
      throw new Error(`Unexpected embedding format: ${typeof emb}`);
    });

    console.log(`[Embeddings] Successfully generated ${embeddings.length} embeddings`);

    return chunks.map((chunk, index) => ({
      embedding: embeddings[index],
      content: chunk.content,
      metadata: chunk.metadata,
    }));
  } catch (error) {
    console.error("[Embeddings] Failed to generate embeddings:", error);
    if (error instanceof Error) {
      console.error("[Embeddings] Error message:", error.message);
      console.error("[Embeddings] Error stack:", error.stack);
    }
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search embeddings by similarity
 */
export async function searchEmbeddings(
  query: string,
  embeddings: Array<{
    id: string;
    content: string;
    embedding: number[] | any;
    metadata?: any;
  }>,
  topK: number = 5,
  minSimilarity: number = 0.5,
): Promise<Array<{ content: string; similarity: number; metadata?: any }>> {
  if (embeddings.length === 0) {
    return [];
  }

  // Generate embedding for the query
  const result = await embedMany({
    model: embeddingModel,
    values: [query],
  });

  let queryEmbedding: number[];
  if (Array.isArray(result.embeddings[0])) {
    queryEmbedding = result.embeddings[0];
  } else if (result.embeddings[0] && Array.isArray((result.embeddings[0] as any).embedding)) {
    queryEmbedding = (result.embeddings[0] as any).embedding;
  } else {
    throw new Error(`Unexpected query embedding format: ${typeof result.embeddings[0]}`);
  }

  // Calculate similarity for each embedding
  const results = embeddings
    .map((emb) => {
      const embedding = Array.isArray(emb.embedding) 
        ? emb.embedding 
        : (emb.embedding as any);
      
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      return {
        content: emb.content,
        similarity,
        metadata: emb.metadata,
      };
    })
    .filter((result) => result.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return results;
}

