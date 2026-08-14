import fs from "fs";
import path from "path";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";
import { publish } from "@/lib/events";
import { serializeTrip, tripInclude } from "@/lib/trip-service";

export const runtime = "nodejs";

/** Small thumbs only — list row on phones (~2× of ~36–44px UI). */
const PHOTO_MAX_EDGE = 160;
const PHOTO_WEBP_QUALITY = 55;

function photoDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "item-photos");
}

function removePhotoFiles(itemId: string) {
  const dir = photoDir();
  for (const ext of ["jpg", "png", "webp"]) {
    const p = path.join(dir, `${itemId}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

/** Upload or replace a pack-item photo (resized/compressed for mobile thumbs). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const user = await requireSessionUser();
    const { tripId } = await params;
    if (!(await userCanAccessTrip(user.id, tripId))) {
      return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });
    }

    const form = await req.formData();
    const itemId = String(form.get("itemId") || "").trim();
    const file = form.get("file");

    if (!itemId) {
      return NextResponse.json({ error: "itemId nötig" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Bilddatei nötig" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Nur Bilder erlaubt" }, { status: 400 });
    }
    if (file.size > 2_000_000) {
      return NextResponse.json({ error: "Max. 2 MB" }, { status: 400 });
    }

    const item = await prisma.packItem.findFirst({
      where: { id: itemId, tripId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const dir = photoDir();
    fs.mkdirSync(dir, { recursive: true });
    removePhotoFiles(itemId);

    const input = Buffer.from(await file.arrayBuffer());
    const thumb = await sharp(input)
      .rotate()
      .resize({
        width: PHOTO_MAX_EDGE,
        height: PHOTO_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: PHOTO_WEBP_QUALITY })
      .toBuffer();

    const abs = path.join(dir, `${itemId}.webp`);
    fs.writeFileSync(abs, thumb);

    const photoUrl = `/api/item-photos/${itemId}?v=${Date.now()}`;
    const updated = await prisma.packItem.update({
      where: { id: itemId },
      data: { photoUrl },
      include: { packedBy: true, suitcase: true },
    });

    publish({
      type: "item_updated",
      tripId,
      itemId,
      payload: {
        ...updated,
        packedAt: updated.packedAt?.toISOString() ?? null,
      },
    });

    const full = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: tripInclude,
    });

    return NextResponse.json({
      item: {
        ...updated,
        packedAt: updated.packedAt?.toISOString() ?? null,
      },
      trip: serializeTrip(full),
    });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}

/** Remove photo from a pack item. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const user = await requireSessionUser();
    const { tripId } = await params;
    if (!(await userCanAccessTrip(user.id, tripId))) {
      return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const itemId =
      String((body as { itemId?: string }).itemId || "").trim() ||
      req.nextUrl.searchParams.get("itemId") ||
      "";

    if (!itemId) {
      return NextResponse.json({ error: "itemId nötig" }, { status: 400 });
    }

    const item = await prisma.packItem.findFirst({
      where: { id: itemId, tripId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    removePhotoFiles(itemId);
    const updated = await prisma.packItem.update({
      where: { id: itemId },
      data: { photoUrl: null },
      include: { packedBy: true, suitcase: true },
    });

    publish({
      type: "item_updated",
      tripId,
      itemId,
      payload: {
        ...updated,
        packedAt: updated.packedAt?.toISOString() ?? null,
      },
    });

    return NextResponse.json({
      ...updated,
      packedAt: updated.packedAt?.toISOString() ?? null,
    });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
