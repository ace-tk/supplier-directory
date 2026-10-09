-- CreateTable
CREATE TABLE "OutfitDesign" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Untitled Outfit',
    "sourceImage" TEXT NOT NULL,
    "analysis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutfitDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutfitDesignVersion" (
    "id" TEXT NOT NULL,
    "outfitId" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "matchGroup" TEXT NOT NULL,
    "matchCategory" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutfitDesignVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutfitDesign_ownerId_idx" ON "OutfitDesign"("ownerId");

-- CreateIndex
CREATE INDEX "OutfitDesignVersion_outfitId_idx" ON "OutfitDesignVersion"("outfitId");

-- AddForeignKey
ALTER TABLE "OutfitDesign" ADD CONSTRAINT "OutfitDesign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutfitDesignVersion" ADD CONSTRAINT "OutfitDesignVersion_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "OutfitDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
