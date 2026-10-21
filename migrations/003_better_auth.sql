-- Run once in the connected Neon database, after 001_usage.sql and 002_rate_limits.sql.
-- Better Auth tables (Google/GitHub sign-in). Generated with the Better Auth CLI
-- (`npx auth@1.7.12 generate`, better-auth 1.7.12) using the schemamind_auth_* model
-- names from lib/auth/server.ts; only "IF NOT EXISTS" was added so it is safe to re-run.
-- The anonymous free-trial counter reuses schemamind_rate_limits from 002 (no new table).
-- Stores provider account ids, name, email and avatar URL; OAuth access/refresh tokens
-- are stored by Better Auth in schemamind_auth_account. No schemas or AI keys.
create table if not exists "schemamind_auth_user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table if not exists "schemamind_auth_session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "schemamind_auth_user" ("id") on delete cascade);

create table if not exists "schemamind_auth_account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "schemamind_auth_user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table if not exists "schemamind_auth_verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create index if not exists "schemamind_auth_session_userId_idx" on "schemamind_auth_session" ("userId");

create index if not exists "schemamind_auth_account_userId_idx" on "schemamind_auth_account" ("userId");

create index if not exists "schemamind_auth_verification_identifier_idx" on "schemamind_auth_verification" ("identifier");
