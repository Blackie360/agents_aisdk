import "server-only";

import { genSaltSync, hashSync } from "bcrypt-ts";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { user, chat, User } from "./schema";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!dbInstance) {
    const postgresUrl =
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.DATABASE_URL;

    if (!postgresUrl) {
      throw new Error(
        "POSTGRES_URL is not defined. Make sure it's set in your environment variables.",
      );
    }

    client = postgres(`${postgresUrl}?sslmode=require`);
    dbInstance = drizzle(client);
  }
  return dbInstance;
}

export async function getUser(email: string): Promise<Array<User>> {
  try {
    const db = getDb();
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error("Failed to get user from database");
    throw error;
  }
}

export async function createUser(email: string, password: string) {
  try {
    const db = getDb();
    // If password is empty (OAuth user), insert without hashing
    if (!password || password === "") {
      return await db.insert(user).values({ email, password: null });
    }
    
    let salt = genSaltSync(10);
    let hash = hashSync(password, salt);

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
    const db = getDb();
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
    console.error("Failed to save chat in database:", error);
    // Don't throw - allow chat to continue even if saving fails
    // This prevents breaking the user experience
    return null;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    const db = getDb();
    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error("Failed to delete chat by id from database");
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    const db = getDb();
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
    const db = getDb();
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error("Failed to get chat by id from database");
    throw error;
  }
}

export async function saveGoogleRefreshToken({
  userId,
  refreshToken,
}: {
  userId: string;
  refreshToken: string;
}) {
  try {
    const db = getDb();
    return await db
      .update(user)
      .set({
        googleRefreshToken: refreshToken,
        isCalendarConnected: true,
      })
      .where(eq(user.id, userId));
  } catch (error) {
    console.error("Failed to save Google refresh token");
    throw error;
  }
}

export async function getGoogleRefreshToken({
  userId,
}: {
  userId: string;
}): Promise<string | null> {
  try {
    const db = getDb();
    const [selectedUser] = await db
      .select({ googleRefreshToken: user.googleRefreshToken })
      .from(user)
      .where(eq(user.id, userId));
    return selectedUser?.googleRefreshToken || null;
  } catch (error) {
    console.error("Failed to get Google refresh token:", error);
    // Return null instead of throwing to handle gracefully
    // This allows the app to continue even if there's a database issue
    return null;
  }
}

export async function getCalendarConnectionStatus({
  userId,
}: {
  userId: string;
}): Promise<boolean> {
  try {
    const db = getDb();
    const [selectedUser] = await db
      .select({ isCalendarConnected: user.isCalendarConnected })
      .from(user)
      .where(eq(user.id, userId));

    return !!selectedUser?.isCalendarConnected;
  } catch (error) {
    console.error("Failed to get calendar connection status", error);
    // Return false instead of throwing to prevent app crashes
    // This handles cases where the column might not exist yet (migration not run)
    return false;
  }
}

export async function setCalendarConnectionStatus({
  userId,
  isConnected,
}: {
  userId: string;
  isConnected: boolean;
}) {
  try {
    const db = getDb();
    return await db
      .update(user)
      .set({ isCalendarConnected: isConnected })
      .where(eq(user.id, userId));
  } catch (error) {
    console.error("Failed to update calendar connection status");
    throw error;
  }
}
