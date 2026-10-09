-- CreateTable
CREATE TABLE "GraphicExtraction" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Untitled Extraction',
    "sourceImage" TEXT NOT NULL,
    "kind" TEXT,
    "description" TEXT,
    "hasCraft" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraphicExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphicExtractionVersion" (
    "id" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "images" TEXT[],
    "removeCraft" BOOLEAN NOT NULL,
    "transparent" BOOLEAN NOT NULL,
    "mode" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphicExtractionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GraphicExtraction_ownerId_idx" ON "GraphicExtraction"("ownerId");

-- CreateIndex
CREATE INDEX "GraphicExtractionVersion_extractionId_idx" ON "GraphicExtractionVersion"("extractionId");

-- AddForeignKey
ALTER TABLE "GraphicExtraction" ADD CONSTRAINT "GraphicExtraction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphicExtractionVersion" ADD CONSTRAINT "GraphicExtractionVersion_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "GraphicExtraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
