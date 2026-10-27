-- CreateEnum
CREATE TYPE "MemoryVisibility" AS ENUM ('PRIVATE', 'PARTICIPANTS');

-- AlterTable
ALTER TABLE "Memory" ADD COLUMN "visibility" "MemoryVisibility" NOT NULL DEFAULT 'PARTICIPANTS';

-- Facts saved before audiences existed stay with the person they describe.
UPDATE "Memory" SET "visibility" = 'PRIVATE';

-- CreateTable
CREATE TABLE "MemoryAudience" (
    "memoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MemoryAudience_pkey" PRIMARY KEY ("memoryId","userId")
);

-- CreateIndex
CREATE INDEX "MemoryAudience_userId_idx" ON "MemoryAudience"("userId");

-- AddForeignKey
ALTER TABLE "MemoryAudience" ADD CONSTRAINT "MemoryAudience_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryAudience" ADD CONSTRAINT "MemoryAudience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "MemoryAudience" ("memoryId", "userId")
SELECT "id", "userId" FROM "Memory";
