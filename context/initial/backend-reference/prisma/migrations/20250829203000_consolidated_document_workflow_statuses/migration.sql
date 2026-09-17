-- Consolidated migration for document workflow statuses
-- This migration combines all the document workflow status changes into a single file

-- Step 1: Add new DocumentStatus enum values
ALTER TYPE "public"."DocumentStatus" ADD VALUE 'NEEDS_REDACTION';
ALTER TYPE "public"."DocumentStatus" ADD VALUE 'REDACTED';
ALTER TYPE "public"."DocumentStatus" ADD VALUE 'RELEASED';

-- Step 2: Add reviewer fields to documents table if they don't exist
DO $$ 
BEGIN
    -- Add reviewed_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'reviewed_by') THEN
        ALTER TABLE "public"."documents" ADD COLUMN "reviewed_by" UUID;
    END IF;
    
    -- Add reviewed_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'reviewed_at') THEN
        ALTER TABLE "public"."documents" ADD COLUMN "reviewed_at" TIMESTAMPTZ(6);
    END IF;
    
    -- Add review_notes column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'review_notes') THEN
        ALTER TABLE "public"."documents" ADD COLUMN "review_notes" TEXT;
    END IF;
END $$;

-- Step 3: Add foreign key constraint for reviewed_by if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'documents_reviewed_by_fkey') THEN
        ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_reviewed_by_fkey" 
        FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 4: Update existing documents to have proper status if needed
-- Note: Only update to existing enum values, not the new ones we just added
UPDATE "public"."documents" 
SET "status" = 'PENDING' 
WHERE "status" IS NULL OR "status" NOT IN ('PENDING', 'APPROVED', 'REJECTED');

-- Step 5: Ensure all documents have a file_path
UPDATE "public"."documents" 
SET "file_path" = COALESCE("file_path", '/uploads/' || "filename")
WHERE "file_path" IS NULL OR "file_path" = '';
