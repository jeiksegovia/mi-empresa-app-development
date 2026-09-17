/*
  Warnings:

  - You are about to drop the column `notes` on the `foia_requests` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."NoteType" AS ENUM ('AGENT', 'REQUESTER', 'SYSTEM');

-- AlterTable
ALTER TABLE "public"."foia_requests" DROP COLUMN "notes",
ADD COLUMN     "internal_notes" TEXT;

-- CreateTable
CREATE TABLE "public"."notes" (
    "id" UUID NOT NULL,
    "foia_request_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "note_type" "public"."NoteType" NOT NULL,
    "created_by" UUID NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_foia_request_id_fkey" FOREIGN KEY ("foia_request_id") REFERENCES "public"."foia_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
