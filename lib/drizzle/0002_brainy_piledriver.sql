CREATE TABLE IF NOT EXISTS "WorkspaceFileEmbedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspaceFileId" uuid NOT NULL,
	"workspaceId" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" json NOT NULL,
	"chunkIndex" integer NOT NULL,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "WorkspaceFileEmbedding" ADD CONSTRAINT "WorkspaceFileEmbedding_workspaceFileId_WorkspaceFile_id_fk" FOREIGN KEY ("workspaceFileId") REFERENCES "public"."WorkspaceFile"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "WorkspaceFileEmbedding" ADD CONSTRAINT "WorkspaceFileEmbedding_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
