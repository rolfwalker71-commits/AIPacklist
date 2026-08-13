import { PrismaClient } from "@prisma/client";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function resolveDatabaseUrl() {
  const url = process.env.DATABASE_URL ?? "file:./data/flexipack.db";
  // absolute docker path like file:/app/data/...
  if (
    url.startsWith("file:/") &&
    !url.startsWith("file://") &&
    !url.startsWith("file:./")
  ) {
    return url;
  }
  if (url.startsWith("file:./") || url.startsWith("file:data/")) {
    const abs = path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      "data",
      "flexipack.db"
    );
    return `file:${abs}`;
  }
  return url;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
