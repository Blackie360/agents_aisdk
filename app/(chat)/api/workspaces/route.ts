import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { z } from "zod";
import {
  getUserWorkspaces,
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
} from "@/db/queries";
import { nanoid } from "nanoid";

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaces = await getUserWorkspaces(session.user.id);
    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error("Failed to get workspaces:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createWorkspaceSchema.parse(body);

    // Generate slug from name
    const slug = `${validatedData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}-${nanoid(6)}`;

    const workspace = await createWorkspace({
      name: validatedData.name,
      slug,
      ownerId: session.user.id,
      description: validatedData.description || null,
    });

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
      );
    }
    console.error("Failed to create workspace:", error);
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 },
    );
  }
}

