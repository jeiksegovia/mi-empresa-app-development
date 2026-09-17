/*
  Warnings:

  - The values [REJECTED] on the enum `DocumentStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [REJECTED] on the enum `RequestStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."DocumentStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'IN_SUPERVISION', 'NEEDS_REDACTION', 'REDACTED', 'REVIEWED', 'RELEASED', 'APPROVED', 'CANCELLED');
ALTER TABLE "public"."documents" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."documents" ALTER COLUMN "status" TYPE "public"."DocumentStatus_new" USING ("status"::text::"public"."DocumentStatus_new");
ALTER TYPE "public"."DocumentStatus" RENAME TO "DocumentStatus_old";
ALTER TYPE "public"."DocumentStatus_new" RENAME TO "DocumentStatus";
DROP TYPE "public"."DocumentStatus_old";
ALTER TABLE "public"."documents" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."RequestStatus_new" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DENIED', 'REOPENED');
ALTER TABLE "public"."foia_requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."foia_requests" ALTER COLUMN "status" TYPE "public"."RequestStatus_new" USING ("status"::text::"public"."RequestStatus_new");
ALTER TYPE "public"."RequestStatus" RENAME TO "RequestStatus_old";
ALTER TYPE "public"."RequestStatus_new" RENAME TO "RequestStatus";
DROP TYPE "public"."RequestStatus_old";
ALTER TABLE "public"."foia_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
