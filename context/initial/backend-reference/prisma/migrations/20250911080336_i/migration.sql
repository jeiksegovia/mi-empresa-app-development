-- AlterTable
ALTER TABLE "public"."documents" ADD COLUMN     "redacted_at" TIMESTAMPTZ(6),
ADD COLUMN     "redacted_file_path" VARCHAR(500),
ADD COLUMN     "redaction_flow" VARCHAR(255),
ADD COLUMN     "redaction_metadata" JSONB;
