-- CreateTable
CREATE TABLE "SupplierIdSequence" (
    "id" SERIAL NOT NULL,

    CONSTRAINT "SupplierIdSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPortal" (
    "id" TEXT NOT NULL,
    "supplierCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "companyName" TEXT,
    "businessType" TEXT,
    "industry" TEXT,
    "gst" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "website" TEXT,
    "linkedin" TEXT,
    "instagram" TEXT,
    "whatsapp" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "description" TEXT,
    "categories" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPortal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalProduct" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "moq" TEXT,
    "priceRange" TEXT,
    "description" TEXT,
    "images" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalDocument" (
    "id" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPortal_supplierCode_key" ON "SupplierPortal"("supplierCode");

-- CreateIndex
CREATE INDEX "SupplierPortal_status_idx" ON "SupplierPortal"("status");

-- CreateIndex
CREATE INDEX "SupplierPortal_supplierCode_idx" ON "SupplierPortal"("supplierCode");

-- CreateIndex
CREATE INDEX "PortalProduct_portalId_idx" ON "PortalProduct"("portalId");

-- CreateIndex
CREATE INDEX "PortalDocument_portalId_idx" ON "PortalDocument"("portalId");

-- AddForeignKey
ALTER TABLE "PortalProduct" ADD CONSTRAINT "PortalProduct_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "SupplierPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalDocument" ADD CONSTRAINT "PortalDocument_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "SupplierPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
