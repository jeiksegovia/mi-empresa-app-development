-- CreateEnum
CREATE TYPE "RequesterType" AS ENUM ('INDIVIDUAL', 'BUSINESS', 'MEDIA', 'ACADEMIC', 'NON_PROFIT', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('INITIAL', 'APPEAL', 'EXPEDITED', 'ADMINISTRATIVE_APPEAL');

-- CreateEnum
CREATE TYPE "FeeCategory" AS ENUM ('COMMERCIAL', 'EDUCATIONAL', 'NEWS_MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "ResponseType" AS ENUM ('FULL_GRANT', 'PARTIAL_GRANT', 'DENIAL', 'NO_RECORDS', 'REFERRED');

-- CreateEnum
CREATE TYPE "SubmissionMethod" AS ENUM ('ONLINE', 'EMAIL', 'MAIL', 'FAX');

-- AlterTable
ALTER TABLE "foia_requests" ADD COLUMN     "acknowledgment_sent" TIMESTAMPTZ(6),
ADD COLUMN     "actual_completion_date" DATE,
ADD COLUMN     "actual_fees" DECIMAL(10,2),
ADD COLUMN     "agency_component_id" UUID,
ADD COLUMN     "agency_component_name" VARCHAR(255),
ADD COLUMN     "appeal_deadline" DATE,
ADD COLUMN     "confirmation_number" VARCHAR(100),
ADD COLUMN     "date_range_end" DATE,
ADD COLUMN     "date_range_start" DATE,
ADD COLUMN     "estimated_completion_date" DATE,
ADD COLUMN     "estimated_fees" DECIMAL(10,2),
ADD COLUMN     "exemptions_cited" VARCHAR(10)[],
ADD COLUMN     "expedited_processing_reason" TEXT,
ADD COLUMN     "expedited_processing_requested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fee_category" "FeeCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "fee_waiver_granted" BOOLEAN,
ADD COLUMN     "fee_waiver_reason" TEXT,
ADD COLUMN     "fee_waiver_requested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "file_types" VARCHAR(100)[],
ADD COLUMN     "language" VARCHAR(10) NOT NULL DEFAULT 'en',
ADD COLUMN     "payment_received" TIMESTAMPTZ(6),
ADD COLUMN     "records_found" INTEGER,
ADD COLUMN     "records_released" INTEGER,
ADD COLUMN     "records_withheld" INTEGER,
ADD COLUMN     "request_type" "RequestType" NOT NULL DEFAULT 'INITIAL',
ADD COLUMN     "requester_address" TEXT,
ADD COLUMN     "requester_city" VARCHAR(100),
ADD COLUMN     "requester_country" VARCHAR(100) NOT NULL DEFAULT 'United States',
ADD COLUMN     "requester_organization" VARCHAR(255),
ADD COLUMN     "requester_state" VARCHAR(2),
ADD COLUMN     "requester_type" "RequesterType" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "requester_zip_code" VARCHAR(10),
ADD COLUMN     "response_letter_sent" TIMESTAMPTZ(6),
ADD COLUMN     "response_type" "ResponseType",
ADD COLUMN     "search_terms" TEXT,
ADD COLUMN     "specific_records" TEXT,
ADD COLUMN     "submission_method" "SubmissionMethod" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "tracking_number" VARCHAR(100);
