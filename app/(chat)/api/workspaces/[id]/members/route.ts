import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  getWorkspaceById,
  getWorkspaceMembers,
  getWorkspaceMemberCount,
} from "@/db/queries";

export async function GET(
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

    const members = await getWorkspaceMembers(params.id);
    const count = await getWorkspaceMemberCount(params.id);

    return NextResponse.json({ members, count });
  } catch (error) {
    console.error("Failed to get workspace members:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace members" },
      { status: 500 },
    );
  }
}

