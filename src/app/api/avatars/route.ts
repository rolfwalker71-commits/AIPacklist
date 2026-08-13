import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureUser } from "@/lib/trip-service";

export const runtime = "nodejs";

function avatarDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "avatars");
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const userId = String(form.get("userId") || "");
  const userName = String(form.get("userName") || "Reisende:r");
  const userColor = String(form.get("userColor") || "#0F766E");

  if (!userId || !(file instanceof File)) {
    return NextResponse.json({ error: "file und userId nötig" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Nur Bilder erlaubt" }, { status: 400 });
  }

  if (file.size > 2_000_000) {
    return NextResponse.json({ error: "Max. 2 MB" }, { status: 400 });
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";

  const dir = avatarDir();
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${userId}.${ext}`;
  const abs = path.join(dir, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(abs, buf);

  const avatarUrl = `/api/avatars/${userId}?v=${Date.now()}`;
  const user = await ensureUser({
    id: userId,
    name: userName,
    color: userColor,
  });
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    color: updated.color,
    avatarUrl: updated.avatarUrl,
  });
}

export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId nötig" }, { status: 400 });
  }
  await prisma.user.updateMany({
    where: { id: userId },
    data: { avatarUrl: null },
  });
  const dir = avatarDir();
  for (const ext of ["jpg", "png", "webp"]) {
    const p = path.join(dir, `${userId}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  return NextResponse.json({ ok: true });
}
