import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { put } from "@vercel/blob";
import {
  getWorkspaceById,
  upsertWorkspaceMembers,
  createWorkspaceFile,
  deleteWorkspaceFileEmbeddings,
  createWorkspaceFileEmbeddings,
} from "@/db/queries";
import {
  extractTextFromFile,
  generateEmbeddings,
} from "@/lib/embeddings";
import Papa from "papaparse";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getWorkspaceById(params.id);
    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    if (workspace.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
      );
    }

    // Validate file type
    if (
      !file.name.endsWith(".csv") &&
      file.type !== "text/csv" &&
      file.type !== "application/vnd.ms-excel"
    ) {
      return NextResponse.json(
        { error: "File must be a CSV file" },
        { status: 400 },
      );
    }

    // Read file content
    const fileContent = await file.text();

    // Parse CSV
    const parseResult = Papa.parse<{ name?: string; email: string }>(
      fileContent,
      {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.toLowerCase().trim(),
      },
    );

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        {
          error: "CSV parsing failed",
          details: parseResult.errors,
        },
        { status: 400 },
      );
    }

    // Validate and extract members
    const members = parseResult.data
      .map((row: Record<string, string>) => {
        // Try to find email column (case-insensitive)
        const emailKey =
          Object.keys(row).find(
            (key) =>
              key.toLowerCase() === "email" ||
              key.toLowerCase() === "e-mail" ||
              key.toLowerCase() === "email address",
          ) || Object.keys(row)[0]; // Fallback to first column

        const nameKey =
          Object.keys(row).find(
            (key) =>
              key.toLowerCase() === "name" ||
              key.toLowerCase() === "full name" ||
              key.toLowerCase() === "fullname",
          ) || null;

        const email = emailKey ? (row[emailKey] as string)?.trim() : undefined;
        const name = nameKey ? (row[nameKey] as string)?.trim() : undefined;

        if (!email || !email.includes("@")) {
          return null;
        }

        const member: { name?: string; email: string; metadata?: any } = {
          email: email.toLowerCase(),
          metadata: row,
        };
        if (name) {
          member.name = name;
        }
        return member;
      })
      .filter((member): member is { name?: string; email: string; metadata?: any } => member !== null);

    if (members.length === 0) {
      return NextResponse.json(
        { error: "No valid members found in CSV" },
        { status: 400 },
      );
    }

    // Upload file to blob storage
    const blob = await put(`workspace-${params.id}-${Date.now()}.csv`, file, {
      access: "public",
      contentType: file.type || "text/csv",
    });

    // Save file reference
    const workspaceFile = await createWorkspaceFile({
      workspaceId: params.id,
      fileName: file.name,
      fileUrl: blob.url,
      fileSize: file.size,
      mimeType: file.type || "text/csv",
      uploadedBy: session.user.id,
    });

    // Generate embeddings for the file content
    let embeddingsCreated = 0;
    let embeddingError: string | null = null;
    
    try {
      console.log(`[Embeddings] Starting embedding generation for file: ${file.name}`);
      
      // Delete existing embeddings for this file if any
      await deleteWorkspaceFileEmbeddings(workspaceFile.id);

      // Extract text chunks from the file
      const chunks = await extractTextFromFile(
        fileContent,
        file.name,
        file.type || "text/csv",
      );
      console.log(`[Embeddings] Extracted ${chunks.length} chunks from file`);

      if (chunks.length === 0) {
        console.warn("[Embeddings] No chunks extracted from file");
        embeddingError = "No content extracted from file";
      } else {
        // Generate embeddings
        const embeddings = await generateEmbeddings(chunks);
        console.log(`[Embeddings] Generated ${embeddings.length} embeddings`);

        if (embeddings.length === 0) {
          console.warn("[Embeddings] No embeddings generated");
          embeddingError = "Failed to generate embeddings";
        } else {
          // Store embeddings in database
          const storedEmbeddings = await createWorkspaceFileEmbeddings(
            embeddings.map((emb, index) => ({
              workspaceFileId: workspaceFile.id,
              workspaceId: params.id,
              content: emb.content,
              embedding: emb.embedding,
              chunkIndex: index,
              metadata: emb.metadata,
            })),
          );
          embeddingsCreated = storedEmbeddings.length;
          console.log(`[Embeddings] Successfully stored ${embeddingsCreated} embeddings in database`);
        }
      }
    } catch (error) {
      console.error("[Embeddings] Failed to generate embeddings for file:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[Embeddings] Error details:", errorMessage);
      embeddingError = errorMessage;
      // Don't fail the upload if embeddings fail, just log the error
    }

    // Upsert members
    const insertedMembers = await upsertWorkspaceMembers(params.id, members);

    return NextResponse.json({
      success: true,
      membersAdded: insertedMembers.length,
      totalRows: parseResult.data.length,
      fileUrl: blob.url,
      embeddingsCreated,
      ...(embeddingError && { embeddingWarning: embeddingError }),
    });
  } catch (error) {
    console.error("Failed to upload CSV:", error);
    return NextResponse.json(
      { error: "Failed to process CSV file" },
      { status: 500 },
    );
  }
}

