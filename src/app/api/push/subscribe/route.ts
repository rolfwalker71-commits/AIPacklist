import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";
import { getVapidPublicKey } from "@/lib/push";

export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser();
    if (!getVapidPublicKey()) {
      return NextResponse.json(
        { error: "Push ist nicht konfiguriert." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const endpoint = String(body.endpoint || "").trim();
    const p256dh = String(body.keys?.p256dh || body.p256dh || "").trim();
    const auth = String(body.keys?.auth || body.auth || "").trim();
    const userAgent =
      typeof body.userAgent === "string"
        ? body.userAgent.slice(0, 200)
        : req.headers.get("user-agent")?.slice(0, 200) || null;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Ungültige Subscription" },
        { status: 400 }
      );
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: user.id,
        endpoint,
        p256dh,
        auth,
        userAgent,
      },
      update: {
        userId: user.id,
        p256dh,
        auth,
        userAgent,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireSessionUser();
    const body = await req.json().catch(() => ({}));
    const endpoint = String((body as { endpoint?: string }).endpoint || "").trim();

    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { userId: user.id, endpoint },
      });
    } else {
      await prisma.pushSubscription.deleteMany({
        where: { userId: user.id },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}

export async function GET() {
  try {
    const user = await requireSessionUser();
    const count = await prisma.pushSubscription.count({
      where: { userId: user.id },
    });
    return NextResponse.json({
      subscribed: count > 0,
      devices: count,
      configured: Boolean(getVapidPublicKey()),
    });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
