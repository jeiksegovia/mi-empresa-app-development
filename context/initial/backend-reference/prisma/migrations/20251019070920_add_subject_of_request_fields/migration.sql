-- AlterTable
ALTER TABLE "public"."exclusions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."exemptions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."foia_requests" ADD COLUMN     "subject_address" TEXT,
ADD COLUMN     "subject_dob" DATE,
ADD COLUMN     "subject_dod_id" VARCHAR(50),
ADD COLUMN     "subject_email" VARCHAR(255),
ADD COLUMN     "subject_name" VARCHAR(255),
ADD COLUMN     "subject_phone" VARCHAR(50),
ADD COLUMN     "subject_ssn" VARCHAR(11),
ALTER COLUMN "exemptions_applied" DROP DEFAULT,
ALTER COLUMN "exclusions_applied" DROP DEFAULT;
