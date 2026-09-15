-- CreateEnum
CREATE TYPE "TicketAccessType" AS ENUM ('SINGLE_DAY', 'MULTI_DAY', 'FULL_PASS');

-- AlterTable
ALTER TABLE "TicketType" ADD COLUMN     "accessType" "TicketAccessType" NOT NULL DEFAULT 'SINGLE_DAY';

-- CreateTable
CREATE TABLE "EventDay" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTypeEventDay" (
    "id" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "eventDayId" TEXT NOT NULL,

    CONSTRAINT "TicketTypeEventDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "eventDayId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInById" TEXT,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventDay_eventId_idx" ON "EventDay"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventDay_eventId_date_key" ON "EventDay"("eventId", "date");

-- CreateIndex
CREATE INDEX "TicketTypeEventDay_eventDayId_idx" ON "TicketTypeEventDay"("eventDayId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTypeEventDay_ticketTypeId_eventDayId_key" ON "TicketTypeEventDay"("ticketTypeId", "eventDayId");

-- CreateIndex
CREATE INDEX "CheckIn_eventDayId_idx" ON "CheckIn"("eventDayId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_reservationId_eventDayId_key" ON "CheckIn"("reservationId", "eventDayId");

-- AddForeignKey
ALTER TABLE "EventDay" ADD CONSTRAINT "EventDay_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTypeEventDay" ADD CONSTRAINT "TicketTypeEventDay_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTypeEventDay" ADD CONSTRAINT "TicketTypeEventDay_eventDayId_fkey" FOREIGN KEY ("eventDayId") REFERENCES "EventDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_eventDayId_fkey" FOREIGN KEY ("eventDayId") REFERENCES "EventDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
