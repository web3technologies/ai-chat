-- CreateTable
CREATE TABLE "Outbox" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Outbox_messageId_key" ON "Outbox"("messageId");

-- CreateIndex
CREATE INDEX "Outbox_publishedAt_createdAt_idx" ON "Outbox"("publishedAt", "createdAt");
