-- CreateEnum
CREATE TYPE "public"."SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_RESPONSE', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."SupportTicketCategory" AS ENUM ('GENERAL', 'TECHNICAL', 'LEGAL', 'PROCESSING', 'CONTENT', 'ACCESS', 'BILLING', 'APPEAL');

-- CreateEnum
CREATE TYPE "public"."MessageSenderType" AS ENUM ('REQUESTER', 'STAFF', 'SYSTEM');

-- CreateTable
CREATE TABLE "public"."support_tickets" (
    "id" UUID NOT NULL,
    "ticket_number" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "public"."SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "public"."SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "category" "public"."SupportTicketCategory" NOT NULL DEFAULT 'GENERAL',
    "foia_request_id" UUID NOT NULL,
    "requester_name" VARCHAR(255) NOT NULL,
    "requester_email" VARCHAR(255) NOT NULL,
    "requester_phone" VARCHAR(50),
    "assigned_to" UUID,
    "created_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."support_ticket_messages" (
    "id" UUID NOT NULL,
    "support_ticket_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "sender_type" "public"."MessageSenderType" NOT NULL,
    "sender_id" UUID,
    "sender_name" VARCHAR(255) NOT NULL,
    "sender_email" VARCHAR(255),
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "public"."support_tickets"("ticket_number");

-- AddForeignKey
ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_foia_request_id_fkey" FOREIGN KEY ("foia_request_id") REFERENCES "public"."foia_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_support_ticket_id_fkey" FOREIGN KEY ("support_ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
