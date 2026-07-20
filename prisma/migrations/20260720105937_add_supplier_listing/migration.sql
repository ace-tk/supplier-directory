-- CreateTable
CREATE TABLE "SupplierListing" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "industry" TEXT NOT NULL,
    "supplierType" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "products" TEXT[],
    "responseTime" TEXT,
    "minimumOrder" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "whatsapp" TEXT,
    "linkedin" TEXT,
    "initials" TEXT NOT NULL DEFAULT '',
    "logoColor" TEXT NOT NULL DEFAULT '#6366F1',
    "yearEstablished" INTEGER,
    "employees" TEXT,
    "notes" TEXT,
    "savedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierListing_country_idx" ON "SupplierListing"("country");

-- CreateIndex
CREATE INDEX "SupplierListing_industry_idx" ON "SupplierListing"("industry");

-- CreateIndex
CREATE INDEX "SupplierListing_verified_idx" ON "SupplierListing"("verified");
