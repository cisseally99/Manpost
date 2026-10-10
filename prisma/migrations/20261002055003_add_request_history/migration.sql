-- CreateTable
CREATE TABLE "RequestHistory" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "headers" JSONB NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" INTEGER,
    "responseTimeMs" INTEGER,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestHistory_userId_createdAt_idx" ON "RequestHistory"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "RequestHistory" ADD CONSTRAINT "RequestHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
