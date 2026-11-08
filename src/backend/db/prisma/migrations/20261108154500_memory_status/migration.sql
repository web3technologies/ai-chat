-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "Memory" ADD COLUMN "status" "MemoryStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Memory" ADD COLUMN "supersededAt" TIMESTAMP(3);
ALTER TABLE "Memory" ADD COLUMN "replacesId" TEXT;

-- CreateIndex
CREATE INDEX "Memory_replacesId_idx" ON "Memory"("replacesId");

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "Memory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
