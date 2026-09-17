-- AlterTable
ALTER TABLE "public"."foia_requests" ADD COLUMN     "subject_city" VARCHAR(100),
ADD COLUMN     "subject_country" VARCHAR(100),
ADD COLUMN     "subject_state" VARCHAR(2),
ADD COLUMN     "subject_zip_code" VARCHAR(10);
