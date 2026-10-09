-- CreateTable
CREATE TABLE "ImageDesign" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Untitled Image Design',
    "sourceImage" TEXT NOT NULL,
    "styleCategory" TEXT,
    "analysis" TEXT,
    "styleOptions" TEXT[],
    "blockOptions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageDesignVersion" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "images" TEXT[],
    "direction" TEXT NOT NULL,
    "target" TEXT,
    "blocks" TEXT[],
    "description" TEXT,
    "mode" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageDesignVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageDesign_ownerId_idx" ON "ImageDesign"("ownerId");

-- CreateIndex
CREATE INDEX "ImageDesignVersion_designId_idx" ON "ImageDesignVersion"("designId");

-- AddForeignKey
ALTER TABLE "ImageDesign" ADD CONSTRAINT "ImageDesign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageDesignVersion" ADD CONSTRAINT "ImageDesignVersion_designId_fkey" FOREIGN KEY ("designId") REFERENCES "ImageDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
