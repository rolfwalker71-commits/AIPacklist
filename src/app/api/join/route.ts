import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSessionUser, authErrorResponse } from "@/lib/auth";
import { inviteStatus } from "@/lib/invite";

/** Resolve invite code → minimal trip info (full access only after joining). */
export async function GET(req: NextRequest) {
  try {
    await requireSessionUser();
    const code = req.nextUrl.searchParams.get("code")?.toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "code required" }, { status: 400 });
    }
    const trip = await prisma.trip.findUnique({
      where: { inviteCode: code },
      select: {
        id: true,
        title: true,
        inviteCode: true,
        inviteEnabled: true,
        inviteExpiresAt: true,
        inviteMaxUses: true,
        inviteUseCount: true,
        startDate: true,
        endDate: true,
      },
    });
    if (!trip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const status = inviteStatus(trip);
    if (!status.ok) {
      return NextResponse.json(
        { error: status.reason || "Einladung ungültig" },
        { status: 403 }
      );
    }
    return NextResponse.json({
      id: trip.id,
      title: trip.title,
      inviteCode: trip.inviteCode,
      startDate: trip.startDate.toISOString(),
      endDate: trip.endDate.toISOString(),
      inviteExpiresAt: trip.inviteExpiresAt?.toISOString() ?? null,
    });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
