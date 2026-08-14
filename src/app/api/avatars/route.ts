import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

function avatarDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "avatars");
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireSessionUser();
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Bilddatei nötig" }, { status: 400 });
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

    // Remove previous formats for this user
    for (const old of ["jpg", "png", "webp"]) {
      const p = path.join(dir, `${sessionUser.id}.${old}`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    const abs = path.join(dir, `${sessionUser.id}.${ext}`);
    fs.writeFileSync(abs, Buffer.from(await file.arrayBuffer()));

    const avatarUrl = `/api/avatars/${sessionUser.id}?v=${Date.now()}`;
    const updated = await prisma.user.update({
      where: { id: sessionUser.id },
      data: { avatarUrl },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      color: updated.color,
      avatarUrl: updated.avatarUrl,
    });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}

export async function DELETE() {
  try {
    const sessionUser = await requireSessionUser();
    await prisma.user.update({
      where: { id: sessionUser.id },
      data: { avatarUrl: null },
    });
    const dir = avatarDir();
    for (const ext of ["jpg", "png", "webp"]) {
      const p = path.join(dir, `${sessionUser.id}.${ext}`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
