import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeTrip, tripInclude } from "@/lib/trip-service";

export async function GET(
  req: NextRequest
) {
  const code = req.nextUrl.searchParams.get("code")?.toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }
  const trip = await prisma.trip.findUnique({
    where: { inviteCode: code },
    include: tripInclude,
  });
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(serializeTrip(trip));
}
