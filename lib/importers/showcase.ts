// First-screen example: a small, realistic multi-tenant SaaS issue tracker in
// Prisma. Written for SchemaMind (not copied from a third-party project) and
// covered by this repository's license. It is parsed and drawn entirely in the
// browser on first visit; no server or AI request is made.
export const showcase = {
  format: "prisma" as const,
  name: "SaaS issue tracker (Prisma)",
  models: [
    "Organization",
    "User",
    "Membership",
    "Project",
    "Issue",
    "Comment",
    "Label",
    "IssueLabel",
  ],
  source: `// Example: multi-tenant SaaS issue tracker. Replace it with your own schema.
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Plan {
  FREE
  PRO
  ENTERPRISE
}

enum Role {
  OWNER
  ADMIN
  MEMBER
}

enum IssueStatus {
  BACKLOG
  TODO
  IN_PROGRESS
  DONE
  CANCELED
}

model Organization {
  id        String       @id @default(cuid())
  name      String
  slug      String       @unique
  plan      Plan         @default(FREE)
  createdAt DateTime     @default(now())
  members   Membership[]
  projects  Project[]
  labels    Label[]
}

model User {
  id          String       @id @default(cuid())
  email       String       @unique
  name        String?
  avatarUrl   String?
  createdAt   DateTime     @default(now())
  memberships Membership[]
  reported    Issue[]      @relation("IssueReporter")
  assigned    Issue[]      @relation("IssueAssignee")
  comments    Comment[]
}

model Membership {
  userId         String
  organizationId String
  role           Role         @default(MEMBER)
  joinedAt       DateTime     @default(now())
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@id([userId, organizationId])
}

model Project {
  id             String       @id @default(cuid())
  organizationId String
  key            String
  name           String
  archived       Boolean      @default(false)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  issues         Issue[]

  @@unique([organizationId, key])
}

model Issue {
  id         String       @id @default(cuid())
  projectId  String
  number     Int
  title      String
  body       String?
  status     IssueStatus  @default(BACKLOG)
  reporterId String
  assigneeId String?
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt
  project    Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  reporter   User         @relation("IssueReporter", fields: [reporterId], references: [id])
  assignee   User?        @relation("IssueAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  comments   Comment[]
  labels     IssueLabel[]

  @@unique([projectId, number])
}

model Comment {
  id        String   @id @default(cuid())
  issueId   String
  authorId  String
  body      String
  createdAt DateTime @default(now())
  issue     Issue    @relation(fields: [issueId], references: [id], onDelete: Cascade)
  author    User     @relation(fields: [authorId], references: [id])
}

model Label {
  id             String       @id @default(cuid())
  organizationId String
  name           String
  color          String       @default("#0f766e")
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  issues         IssueLabel[]

  @@unique([organizationId, name])
}

model IssueLabel {
  issueId String
  labelId String
  issue   Issue  @relation(fields: [issueId], references: [id], onDelete: Cascade)
  label   Label  @relation(fields: [labelId], references: [id], onDelete: Cascade)

  @@id([issueId, labelId])
}
`,
};
