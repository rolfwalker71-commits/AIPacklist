-- AlterTable
ALTER TABLE "Trip" ADD COLUMN "routeShareCode" TEXT;
ALTER TABLE "Trip" ADD COLUMN "routeShareEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Trip" ADD COLUMN "routeShareExpiresAt" DATETIME;
ALTER TABLE "Trip" ADD COLUMN "routeShareMaxUses" INTEGER;
ALTER TABLE "Trip" ADD COLUMN "routeShareUseCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Trip_routeShareCode_key" ON "Trip"("routeShareCode");
