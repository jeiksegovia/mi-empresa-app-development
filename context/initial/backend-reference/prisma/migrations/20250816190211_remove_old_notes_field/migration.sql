/*
  Warnings:

  - You are about to drop the column `internal_notes` on the `foia_requests` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."foia_requests" DROP COLUMN "internal_notes";
