/*
  Warnings:

  - You are about to drop the column `assigned_at` on the `user_roles` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[username]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `user_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."UserRoleEnum" AS ENUM ('ADMINISTRATOR', 'SUPERVISOR', 'USER', 'REQUESTOR', 'CLERK');

-- AlterTable
ALTER TABLE "public"."user_roles" DROP COLUMN "assigned_at";

-- AlterTable
ALTER TABLE "public"."user_sessions" ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL,
ALTER COLUMN "user_agent" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "first_name" VARCHAR(100),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_name" VARCHAR(100),
ADD COLUMN     "password_hash" VARCHAR(255),
ADD COLUMN     "role" "public"."UserRoleEnum",
ADD COLUMN     "username" VARCHAR(50),
ALTER COLUMN "idme_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");
