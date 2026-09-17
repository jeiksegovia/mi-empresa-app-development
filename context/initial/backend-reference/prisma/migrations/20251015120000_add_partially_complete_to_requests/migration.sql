-- Add boolean flag to track partial completion of FOIA requests
ALTER TABLE "foia_requests" ADD COLUMN "partially_complete" BOOLEAN NOT NULL DEFAULT FALSE;


