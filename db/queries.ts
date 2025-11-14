import "server-only";

import { genSaltSync, hashSync } from "bcrypt-ts";
import { desc, eq, and, sql } from "drizzle-orm";

import { db } from "./index";
import {
  user,
  chat,
  workspace,
  workspaceMember,
  workspaceFile,
  User,
  Workspace,
  WorkspaceMember,
  NewWorkspace,
  NewWorkspaceMember,
} from "./schema";

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error("Failed to get user from database");
    throw error;
  }
}

export async function createUser(email: string, password: string) {
  let salt = genSaltSync(10);
  let hash = hashSync(password, salt);

  try {
    return await db.insert(user).values({ email, password: hash });
  } catch (error) {
    console.error("Failed to create user in database");
    throw error;
  }
}

export async function saveChat({
  id,
  messages,
  userId,
}: {
  id: string;
  messages: any;
  userId: string;
}) {
  try {
    const selectedChats = await db.select().from(chat).where(eq(chat.id, id));

    if (selectedChats.length > 0) {
      return await db
        .update(chat)
        .set({
          messages: JSON.stringify(messages),
        })
        .where(eq(chat.id, id));
    }

    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      messages: JSON.stringify(messages),
      userId,
    });
  } catch (error) {
    console.error("Failed to save chat in database");
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error("Failed to delete chat by id from database");
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(chat)
      .where(eq(chat.userId, id))
      .orderBy(desc(chat.createdAt));
  } catch (error) {
    console.error("Failed to get chats by user from database");
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error("Failed to get chat by id from database");
    throw error;
  }
}

// Workspace queries
export async function getUserWorkspaces(userId: string): Promise<Workspace[]> {
  try {
    return await db
      .select()
      .from(workspace)
      .where(eq(workspace.ownerId, userId))
      .orderBy(desc(workspace.createdAt));
  } catch (error) {
    console.error("Failed to get user workspaces from database");
    throw error;
  }
}

export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  try {
    const [selectedWorkspace] = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, id));
    return selectedWorkspace || null;
  } catch (error) {
    console.error("Failed to get workspace by id from database");
    throw error;
  }
}

export async function getWorkspaceBySlug(
  slug: string,
): Promise<Workspace | null> {
  try {
    const [selectedWorkspace] = await db
      .select()
      .from(workspace)
      .where(eq(workspace.slug, slug));
    return selectedWorkspace || null;
  } catch (error) {
    console.error("Failed to get workspace by slug from database");
    throw error;
  }
}

export async function createWorkspace(
  data: NewWorkspace,
): Promise<Workspace> {
  try {
    const [newWorkspace] = await db
      .insert(workspace)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();
    return newWorkspace;
  } catch (error) {
    console.error("Failed to create workspace in database");
    throw error;
  }
}

export async function updateWorkspace(
  id: string,
  userId: string,
  data: Partial<Omit<NewWorkspace, "id" | "ownerId">>,
): Promise<Workspace | null> {
  try {
    const [updatedWorkspace] = await db
      .update(workspace)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(workspace.id, id), eq(workspace.ownerId, userId)))
      .returning();
    return updatedWorkspace || null;
  } catch (error) {
    console.error("Failed to update workspace in database");
    throw error;
  }
}

export async function deleteWorkspace(
  id: string,
  userId: string,
): Promise<boolean> {
  try {
    const result = await db
      .delete(workspace)
      .where(and(eq(workspace.id, id), eq(workspace.ownerId, userId)));
    return true;
  } catch (error) {
    console.error("Failed to delete workspace from database");
    throw error;
  }
}

export async function getWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  try {
    return await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.workspaceId, workspaceId))
      .orderBy(desc(workspaceMember.createdAt));
  } catch (error) {
    console.error("Failed to get workspace members from database");
    throw error;
  }
}

export async function getWorkspaceMemberCount(
  workspaceId: string,
): Promise<number> {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceMember)
      .where(eq(workspaceMember.workspaceId, workspaceId));
    return Number(result[0]?.count || 0);
  } catch (error) {
    console.error("Failed to get workspace member count from database");
    throw error;
  }
}

export async function upsertWorkspaceMembers(
  workspaceId: string,
  members: Array<{ name?: string; email: string; metadata?: any }>,
): Promise<WorkspaceMember[]> {
  try {
    const insertedMembers: WorkspaceMember[] = [];

    for (const member of members) {
      // Check if member already exists
      const existing = await db
        .select()
        .from(workspaceMember)
        .where(
          and(
            eq(workspaceMember.workspaceId, workspaceId),
            eq(workspaceMember.email, member.email),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing member
        const [updated] = await db
          .update(workspaceMember)
          .set({
            name: member.name || existing[0].name,
            metadata: member.metadata || existing[0].metadata,
            updatedAt: new Date(),
          })
          .where(eq(workspaceMember.id, existing[0].id))
          .returning();
        if (updated) insertedMembers.push(updated);
      } else {
        // Insert new member
        const [inserted] = await db
          .insert(workspaceMember)
          .values({
            workspaceId,
            name: member.name || null,
            email: member.email,
            metadata: member.metadata || null,
            updatedAt: new Date(),
          })
          .returning();
        if (inserted) insertedMembers.push(inserted);
      }
    }

    return insertedMembers;
  } catch (error) {
    console.error("Failed to upsert workspace members in database");
    throw error;
  }
}

export async function deleteWorkspaceMember(
  id: string,
  workspaceId: string,
): Promise<boolean> {
  try {
    await db
      .delete(workspaceMember)
      .where(
        and(
          eq(workspaceMember.id, id),
          eq(workspaceMember.workspaceId, workspaceId),
        ),
      );
    return true;
  } catch (error) {
    console.error("Failed to delete workspace member from database");
    throw error;
  }
}

export async function createWorkspaceFile(
  data: {
    workspaceId: string;
    fileName: string;
    fileUrl?: string;
    fileSize?: number;
    mimeType?: string;
    checksum?: string;
    uploadedBy: string;
  },
) {
  try {
    const [newFile] = await db
      .insert(workspaceFile)
      .values(data)
      .returning();
    return newFile;
  } catch (error) {
    console.error("Failed to create workspace file in database");
    throw error;
  }
}

export async function getWorkspaceFiles(workspaceId: string) {
  try {
    return await db
      .select()
      .from(workspaceFile)
      .where(eq(workspaceFile.workspaceId, workspaceId))
      .orderBy(desc(workspaceFile.createdAt));
  } catch (error) {
    console.error("Failed to get workspace files from database");
    throw error;
  }
}

