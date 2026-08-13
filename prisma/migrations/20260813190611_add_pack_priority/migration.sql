-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PackItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'calculator',
    "packedAt" DATETIME,
    "packedByUserId" TEXT,
    "suitcaseId" TEXT,
    "tripId" TEXT NOT NULL,
    CONSTRAINT "PackItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PackItem_packedByUserId_fkey" FOREIGN KEY ("packedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PackItem_suitcaseId_fkey" FOREIGN KEY ("suitcaseId") REFERENCES "Suitcase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PackItem" ("category", "id", "isShared", "name", "notes", "packedAt", "packedByUserId", "quantity", "source", "suitcaseId", "tripId") SELECT "category", "id", "isShared", "name", "notes", "packedAt", "packedByUserId", "quantity", "source", "suitcaseId", "tripId" FROM "PackItem";
DROP TABLE "PackItem";
ALTER TABLE "new_PackItem" RENAME TO "PackItem";
CREATE INDEX "PackItem_tripId_idx" ON "PackItem"("tripId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
