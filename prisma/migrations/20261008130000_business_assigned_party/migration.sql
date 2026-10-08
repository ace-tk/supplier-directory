-- CreateTable
CREATE TABLE "BusinessAssignedParty" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "partyType" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "responsibleMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessAssignedParty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessAssignedParty_ownerId_idx" ON "BusinessAssignedParty"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessAssignedParty_businessId_partyType_partyId_key" ON "BusinessAssignedParty"("businessId", "partyType", "partyId");

-- AddForeignKey
ALTER TABLE "BusinessAssignedParty" ADD CONSTRAINT "BusinessAssignedParty_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAssignedParty" ADD CONSTRAINT "BusinessAssignedParty_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessAssignedParty" ADD CONSTRAINT "BusinessAssignedParty_responsibleMemberId_fkey" FOREIGN KEY ("responsibleMemberId") REFERENCES "BusinessMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

