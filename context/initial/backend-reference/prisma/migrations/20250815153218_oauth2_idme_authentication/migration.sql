UPDATE "public"."users" 
SET 
  "idme_id" = COALESCE("username", 'legacy_user_' || "id"),
  "name" = COALESCE("first_name" || ' ' || "last_name", "username", 'Legacy User')
WHERE "idme_id" IS NULL OR "name" IS NULL;

-- DropIndex
DROP INDEX "public"."users_username_key";

-- AlterTable
ALTER TABLE "public"."permissions" DROP COLUMN "created_at",
DROP COLUMN "updated_at";

-- AlterTable
ALTER TABLE "public"."role_permissions" DROP COLUMN "created_at";

-- AlterTable
ALTER TABLE "public"."roles" DROP COLUMN "created_at",
DROP COLUMN "updated_at";

-- AlterTable
ALTER TABLE "public"."user_sessions" ALTER COLUMN "ip_address" SET NOT NULL,
ALTER COLUMN "user_agent" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "first_name",
DROP COLUMN "is_active",
DROP COLUMN "last_name",
DROP COLUMN "password_hash",
DROP COLUMN "role",
DROP COLUMN "username",
ALTER COLUMN "idme_id" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL;

-- DropEnum
DROP TYPE "public"."UserRole";
