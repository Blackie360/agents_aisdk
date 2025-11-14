import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { put } from "@vercel/blob";
import {
  getWorkspaceById,
  upsertWorkspaceMembers,
  createWorkspaceFile,
} from "@/db/queries";
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
      .map((row) => {
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

        const email = row[emailKey]?.trim();
        const name = nameKey ? row[nameKey]?.trim() : undefined;

        if (!email || !email.includes("@")) {
          return null;
        }

        return {
          name: name || undefined,
          email: email.toLowerCase(),
          metadata: row,
        };
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
    await createWorkspaceFile({
      workspaceId: params.id,
      fileName: file.name,
      fileUrl: blob.url,
      fileSize: file.size,
      mimeType: file.type || "text/csv",
      uploadedBy: session.user.id,
    });

    // Upsert members
    const insertedMembers = await upsertWorkspaceMembers(params.id, members);

    return NextResponse.json({
      success: true,
      membersAdded: insertedMembers.length,
      totalRows: parseResult.data.length,
      fileUrl: blob.url,
    });
  } catch (error) {
    console.error("Failed to upload CSV:", error);
    return NextResponse.json(
      { error: "Failed to process CSV file" },
      { status: 500 },
    );
  }
}

