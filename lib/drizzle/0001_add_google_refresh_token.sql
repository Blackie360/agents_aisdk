-- Add googleRefreshToken column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleRefreshToken" varchar(512);




