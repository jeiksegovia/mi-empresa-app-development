/*
  Warnings:

  - The values [SCIENTIFIC] on the enum `FeeCategory` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."FeeCategory_new" AS ENUM ('COMMERCIAL', 'EDUCATIONAL', 'NEWS_MEDIA', 'SCIENTIFIC_INSTITUTION', 'OTHER');
ALTER TABLE "public"."foia_requests" ALTER COLUMN "fee_category" DROP DEFAULT;
ALTER TABLE "public"."foia_requests" ALTER COLUMN "fee_category" TYPE "public"."FeeCategory_new" USING (
  CASE 
    WHEN "fee_category"::text = 'SCIENTIFIC' THEN 'SCIENTIFIC_INSTITUTION'::text
    ELSE "fee_category"::text
  END::"public"."FeeCategory_new"
);
ALTER TYPE "public"."FeeCategory" RENAME TO "FeeCategory_old";
ALTER TYPE "public"."FeeCategory_new" RENAME TO "FeeCategory";
DROP TYPE "public"."FeeCategory_old";
ALTER TABLE "public"."foia_requests" ALTER COLUMN "fee_category" SET DEFAULT 'OTHER';
COMMIT;
