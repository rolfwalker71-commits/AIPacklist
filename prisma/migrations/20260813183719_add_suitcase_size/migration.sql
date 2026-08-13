-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Suitcase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "size" TEXT NOT NULL DEFAULT 'MEDIUM',
    "ownerUserId" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "tripId" TEXT NOT NULL,
    CONSTRAINT "Suitcase_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Suitcase_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Suitcase" ("id", "name", "ownerUserId", "tripId") SELECT "id", "name", "ownerUserId", "tripId" FROM "Suitcase";
DROP TABLE "Suitcase";
ALTER TABLE "new_Suitcase" RENAME TO "Suitcase";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
