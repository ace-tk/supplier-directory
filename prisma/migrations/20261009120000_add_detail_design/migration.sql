-- CreateTable
CREATE TABLE "DetailDesign" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Untitled Detail Design',
    "sourceImage" TEXT NOT NULL,
    "styleCategory" TEXT NOT NULL,
    "referenceStyle" TEXT,
    "analysis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetailDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetailDesignVersion" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL,
    "designCount" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetailDesignVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DetailDesign_ownerId_idx" ON "DetailDesign"("ownerId");

-- CreateIndex
CREATE INDEX "DetailDesignVersion_designId_idx" ON "DetailDesignVersion"("designId");

-- AddForeignKey
ALTER TABLE "DetailDesign" ADD CONSTRAINT "DetailDesign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailDesignVersion" ADD CONSTRAINT "DetailDesignVersion_designId_fkey" FOREIGN KEY ("designId") REFERENCES "DetailDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
