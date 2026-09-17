-- CreateEnum
CREATE TYPE "public"."NotePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."NoteCategory" AS ENUM ('GENERAL', 'LEGAL', 'PROCESSING', 'REDACTION', 'COMMUNICATION');

-- AlterTable
ALTER TABLE "public"."notes" ADD COLUMN     "category" "public"."NoteCategory" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "priority" "public"."NotePriority" NOT NULL DEFAULT 'MEDIUM';
