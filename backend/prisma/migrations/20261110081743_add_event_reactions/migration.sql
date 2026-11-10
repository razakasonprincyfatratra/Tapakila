-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'INTERESTED');

-- CreateTable
CREATE TABLE "EventReaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventReaction_eventId_idx" ON "EventReaction"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventReaction_userId_eventId_type_key" ON "EventReaction"("userId", "eventId", "type");

-- CreateIndex
CREATE INDEX "Comment_eventId_createdAt_idx" ON "Comment"("eventId", "createdAt");

-- AddForeignKey
ALTER TABLE "EventReaction" ADD CONSTRAINT "EventReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReaction" ADD CONSTRAINT "EventReaction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
