-- CreateTable
CREATE TABLE "CollectionProposal" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Untitled Collection',
    "sourceImages" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionProposalVersion" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "collectionCount" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "coreDNA" TEXT[],
    "looks" JSONB NOT NULL,
    "lookImages" TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionProposalVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionProposal_ownerId_idx" ON "CollectionProposal"("ownerId");

-- CreateIndex
CREATE INDEX "CollectionProposalVersion_proposalId_idx" ON "CollectionProposalVersion"("proposalId");

-- AddForeignKey
ALTER TABLE "CollectionProposal" ADD CONSTRAINT "CollectionProposal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionProposalVersion" ADD CONSTRAINT "CollectionProposalVersion_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "CollectionProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
