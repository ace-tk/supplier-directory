-- AlterTable: Fabric to Design shares the DetailDesign tables; "kind" tells them apart.
ALTER TABLE "DetailDesign" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'detail';
