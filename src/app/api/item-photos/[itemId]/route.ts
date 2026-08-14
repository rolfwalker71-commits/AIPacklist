import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse(null, { status: 401 });
  }

  const { itemId } = await params;
  const safe = itemId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) {
    return new NextResponse(null, { status: 404 });
  }

  const item = await prisma.packItem.findUnique({
    where: { id: safe },
    select: { tripId: true },
  });
  if (!item || !(await userCanAccessTrip(user.id, item.tripId))) {
    return new NextResponse(null, { status: 403 });
  }

  const dir = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "data",
    "item-photos"
  );

  for (const [ext, type] of [
    ["webp", "image/webp"],
    ["png", "image/png"],
    ["jpg", "image/jpeg"],
  ] as const) {
    const file = path.join(dir, `${safe}.${ext}`);
    if (fs.existsSync(file)) {
      const buf = fs.readFileSync(file);
      return new NextResponse(buf, {
        headers: {
          "Content-Type": type,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  }

  return new NextResponse(null, { status: 404 });
}
