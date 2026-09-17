/*
  Warnings:

  - You are about to drop the column `requester_email` on the `support_tickets` table. All the data in the column will be lost.
  - You are about to drop the column `requester_name` on the `support_tickets` table. All the data in the column will be lost.
  - You are about to drop the column `requester_phone` on the `support_tickets` table. All the data in the column will be lost.
  - Made the column `created_by` on table `support_tickets` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."support_tickets" DROP CONSTRAINT "support_tickets_created_by_fkey";

-- AlterTable
ALTER TABLE "public"."support_tickets" DROP COLUMN "requester_email",
DROP COLUMN "requester_name",
DROP COLUMN "requester_phone",
ALTER COLUMN "created_by" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
