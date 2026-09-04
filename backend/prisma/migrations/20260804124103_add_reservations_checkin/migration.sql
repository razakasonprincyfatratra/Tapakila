/*
  Warnings:

  - A unique constraint covering the columns `[backupCode]` on the table `Reservation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "backupCode" TEXT,
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "checkedInById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_backupCode_key" ON "Reservation"("backupCode");

-- CreateIndex
CREATE INDEX "Reservation_qrCode_idx" ON "Reservation"("qrCode");

-- CreateIndex
CREATE INDEX "Reservation_backupCode_idx" ON "Reservation"("backupCode");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
