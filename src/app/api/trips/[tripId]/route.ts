import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeTrip, tripInclude } from "@/lib/trip-service";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const user = await requireSessionUser();
    const { tripId } = await params;
    if (!(await userCanAccessTrip(user.id, tripId))) {
      return NextResponse.json({ error: "Kein Zugang" }, { status: 403 });
    }
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: tripInclude,
    });
    if (!trip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(serializeTrip(trip));
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
