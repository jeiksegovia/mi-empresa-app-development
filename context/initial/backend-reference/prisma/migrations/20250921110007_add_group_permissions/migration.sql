-- AlterTable
ALTER TABLE "public"."permissions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."roles" ALTER COLUMN "updated_at" DROP DEFAULT;
