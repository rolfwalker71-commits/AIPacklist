-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "inviteEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inviteExpiresAt" DATETIME,
    "inviteMaxUses" INTEGER,
    "inviteUseCount" INTEGER NOT NULL DEFAULT 0,
    "aiInsights" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Trip_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Trip" ("aiInsights", "createdAt", "endDate", "id", "inviteCode", "ownerId", "startDate", "title", "updatedAt") SELECT "aiInsights", "createdAt", "endDate", "id", "inviteCode", "ownerId", "startDate", "title", "updatedAt" FROM "Trip";
DROP TABLE "Trip";
ALTER TABLE "new_Trip" RENAME TO "Trip";
CREATE UNIQUE INDEX "Trip_inviteCode_key" ON "Trip"("inviteCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
