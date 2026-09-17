/*
  Warnings:

  - The values [EXPEDITED,ADMINISTRATIVE_APPEAL] on the enum `RequestType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."RequestType_new" AS ENUM ('INITIAL', 'APPEAL', 'AMENDMENT');
ALTER TABLE "public"."foia_requests" ALTER COLUMN "request_type" DROP DEFAULT;
ALTER TABLE "public"."foia_requests" ALTER COLUMN "request_type" TYPE "public"."RequestType_new" USING ("request_type"::text::"public"."RequestType_new");
ALTER TYPE "public"."RequestType" RENAME TO "RequestType_old";
ALTER TYPE "public"."RequestType_new" RENAME TO "RequestType";
DROP TYPE "public"."RequestType_old";
ALTER TABLE "public"."foia_requests" ALTER COLUMN "request_type" SET DEFAULT 'INITIAL';
COMMIT;
