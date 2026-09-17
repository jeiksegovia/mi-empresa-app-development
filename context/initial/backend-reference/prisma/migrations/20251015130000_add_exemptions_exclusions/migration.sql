-- Add exemptions and exclusions tables and arrays to FOIA requests
CREATE TABLE "exemptions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exemptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exclusions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exclusions_pkey" PRIMARY KEY ("id")
);

-- Add arrays to FOIA requests
ALTER TABLE "foia_requests" ADD COLUMN "exemptions_applied" VARCHAR(10)[] DEFAULT '{}';
ALTER TABLE "foia_requests" ADD COLUMN "exclusions_applied" VARCHAR(20)[] DEFAULT '{}';

-- Create unique indexes
CREATE UNIQUE INDEX "exemptions_code_key" ON "exemptions"("code");
CREATE UNIQUE INDEX "exclusions_code_key" ON "exclusions"("code");

-- Insert exemption data
INSERT INTO "exemptions" ("id", "code", "title", "description") VALUES
('550e8400-e29b-41d4-a716-446655440001', 'EX1', 'Exemption 1', 'Classified national defense and foreign relations information'),
('550e8400-e29b-41d4-a716-446655440002', 'EX2', 'Exemption 2', 'Internal agency rules and practices'),
('550e8400-e29b-41d4-a716-446655440003', 'EX3', 'Exemption 3', 'Information exempt under other laws'),
('550e8400-e29b-41d4-a716-446655440004', 'EX4', 'Exemption 4', 'Trade secrets and confidential business information'),
('550e8400-e29b-41d4-a716-446655440005', 'EX5', 'Exemption 5', 'Inter- or intra-agency communications protected by legal privileges'),
('550e8400-e29b-41d4-a716-446655440006', 'EX6', 'Exemption 6', 'Information that would invade personal privacy'),
('550e8400-e29b-41d4-a716-446655440007', 'EX7', 'Exemption 7', 'Records or information compiled for law enforcement purposes'),
('550e8400-e29b-41d4-a716-446655440008', 'EX8', 'Exemption 8', 'Information related to regulation of financial institutions'),
('550e8400-e29b-41d4-a716-446655440009', 'EX9', 'Exemption 9', 'Geological and geophysical information about wells');

-- Insert exclusion data
INSERT INTO "exclusions" ("id", "code", "title", "description") VALUES
('650e8400-e29b-41d4-a716-446655440001', 'EXCL1', 'Exclusion 1 (b)(7)(A)', 'Allows an agency to exclude records if acknowledging them would interfere with an ongoing criminal law enforcement investigation'),
('650e8400-e29b-41d4-a716-446655440002', 'EXCL2', 'Exclusion 2 (b)(7)(B)', 'Applies when an informant''s records are requested and disclosure could reasonably be expected to reveal the informant''s identity'),
('650e8400-e29b-41d4-a716-446655440003', 'EXCL3', 'Exclusion 3 (c)(1)', 'Applies to classified FBI foreign intelligence, counterintelligence, or international terrorism records');
