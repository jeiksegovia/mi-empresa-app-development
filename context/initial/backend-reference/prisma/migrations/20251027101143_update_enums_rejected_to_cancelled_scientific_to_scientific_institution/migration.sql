/*
  Warnings:

  - The values [SCIENTIFIC] on the enum `FeeCategory` will be removed. If these variants are still used in the database, this will fail.
  - The values [REJECTED] on the enum `RequestStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."FeeCategory_new" AS ENUM ('COMMERCIAL', 'EDUCATIONAL', 'NEWS_MEDIA', 'SCIENTIFIC_INSTITUTION', 'OTHER');
ALTER TABLE "public"."foia_requests" ALTER COLUMN "fee_category" DROP DEFAULT;
ALTER TABLE "public"."foia_requests" ALTER COLUMN "fee_category" TYPE "public"."FeeCategory_new" USING ("fee_category"::text::"public"."FeeCategory_new");
ALTER TYPE "public"."FeeCategory" RENAME TO "FeeCategory_old";
ALTER TYPE "public"."FeeCategory_new" RENAME TO "FeeCategory";
DROP TYPE "public"."FeeCategory_old";
ALTER TABLE "public"."foia_requests" ALTER COLUMN "fee_category" SET DEFAULT 'OTHER';
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
