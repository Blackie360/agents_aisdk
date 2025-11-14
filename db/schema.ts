import { Message } from "ai";
import { InferSelectModel, InferInsertModel } from "drizzle-orm";
import {
  pgTable,
  varchar,
  timestamp,
  json,
  uuid,
  boolean,
  text,
  integer,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const user = pgTable("user", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }),
  name: varchar("name", { length: 255 }),
  image: varchar("image", { length: 500 }),
  emailVerified: timestamp("emailVerified"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;

export const account = pgTable("account", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: varchar("token_type", { length: 255 }),
  scope: varchar("scope", { length: 255 }),
  id_token: text("id_token"),
  session_state: varchar("session_state", { length: 255 }),
});

export const session = pgTable("session", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  sessionToken: varchar("sessionToken", { length: 255 }).notNull().unique(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationToken = pgTable("verificationToken", {
  identifier: varchar("identifier", { length: 255 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expires: timestamp("expires").notNull(),
});

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  messages: json("messages").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspaceId").references(() => workspace.id, {
    onDelete: "set null",
  }),
});

export type Chat = Omit<InferSelectModel<typeof chat>, "messages"> & {
  messages: Array<Message>;
};

export const workspace = pgTable("Workspace", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  ownerId: uuid("ownerId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  description: text("description"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Workspace = InferSelectModel<typeof workspace>;
export type NewWorkspace = InferInsertModel<typeof workspace>;

export const workspaceMember = pgTable(
  "WorkspaceMember",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    workspaceId: uuid("workspaceId")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull(),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    workspaceEmailUnique: unique().on(table.workspaceId, table.email),
  }),
);

export type WorkspaceMember = InferSelectModel<typeof workspaceMember>;
export type NewWorkspaceMember = InferInsertModel<typeof workspaceMember>;

export const workspaceFile = pgTable("WorkspaceFile", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  workspaceId: uuid("workspaceId")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 500 }),
  fileSize: integer("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  checksum: varchar("checksum", { length: 255 }),
  uploadedBy: uuid("uploadedBy")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type WorkspaceFile = InferSelectModel<typeof workspaceFile>;

export const workspaceFileEmbedding = pgTable("WorkspaceFileEmbedding", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  workspaceFileId: uuid("workspaceFileId")
    .notNull()
    .references(() => workspaceFile.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspaceId")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: json("embedding").notNull(), // Array of numbers
  chunkIndex: integer("chunkIndex").notNull(),
  metadata: json("metadata"), // Additional metadata like row number, column names, etc.
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type WorkspaceFileEmbedding = InferSelectModel<typeof workspaceFileEmbedding>;
export type NewWorkspaceFileEmbedding = InferInsertModel<typeof workspaceFileEmbedding>;

// Relations
export const userRelations = relations(user, ({ many }) => ({
  workspaces: many(workspace),
  chats: many(chat),
  accounts: many(account),
  sessions: many(session),
}));

export const workspaceRelations = relations(workspace, ({ one, many }) => ({
  owner: one(user, {
    fields: [workspace.ownerId],
    references: [user.id],
  }),
  members: many(workspaceMember),
  chats: many(chat),
  files: many(workspaceFile),
  fileEmbeddings: many(workspaceFileEmbedding),
}));

export const workspaceFileRelations = relations(workspaceFile, ({ one, many }) => ({
  workspace: one(workspace, {
    fields: [workspaceFile.workspaceId],
    references: [workspace.id],
  }),
  embeddings: many(workspaceFileEmbedding),
}));

export const workspaceMemberRelations = relations(
  workspaceMember,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [workspaceMember.workspaceId],
      references: [workspace.id],
    }),
  }),
);

