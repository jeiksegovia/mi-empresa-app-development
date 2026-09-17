-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "public"."invoices" (
    "id" UUID NOT NULL,
    "foia_request_id" UUID NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(10,2) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "date_created" TIMESTAMPTZ(6) NOT NULL,
    "date_due" TIMESTAMPTZ(6) NOT NULL,
    "payment_page_url" VARCHAR(500),
    "receipt_url" VARCHAR(500),
    "pay_gov_reference" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "public"."invoices"("invoice_number");

-- AddForeignKey
ALTER TABLE "public"."invoices" ADD CONSTRAINT "invoices_foia_request_id_fkey" FOREIGN KEY ("foia_request_id") REFERENCES "public"."foia_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
