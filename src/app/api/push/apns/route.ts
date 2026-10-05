import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";
import { apnsConfigured } from "@/lib/apns";

/** Is native push set up on the server? */
export async function GET() {
  try {
    await requireSessionUser();
    return NextResponse.json({ configured: apnsConfigured() });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}

/** Register (or move) an iOS device token for the signed-in user. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser();
    const body = (await req.json().catch(() => ({}))) as {
      token?: string;
      environment?: string;
    };
    const token = String(body.token || "").trim().toLowerCase();
    if (!/^[0-9a-f]{32,200}$/.test(token)) {
      return NextResponse.json({ error: "Ungültiges Token" }, { status: 400 });
    }
    const environment =
      body.environment === "sandbox" ? "sandbox" : "production";

    await prisma.apnsDevice.upsert({
      where: { token },
      create: { userId: user.id, token, environment },
      update: { userId: user.id, environment },
    });
    return NextResponse.json({ ok: true, configured: apnsConfigured() });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}

/** Remove a device token (sign-out or notifications switched off). */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireSessionUser();
    const body = (await req.json().catch(() => ({}))) as { token?: string };
    const token = String(body.token || "").trim().toLowerCase();
    if (token) {
      await prisma.apnsDevice.deleteMany({ where: { token, userId: user.id } });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
