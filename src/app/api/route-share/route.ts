import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";
import {
  createTripFromRouteShare,
  serializeTrip,
} from "@/lib/trip-service";
import { routeShareStatus } from "@/lib/route-share";
import { formatDate } from "@/lib/utils";

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

/** Preview a shared route (no pack data). */
export async function GET(req: NextRequest) {
  try {
    await requireSessionUser();
    const code = normalizeCode(req.nextUrl.searchParams.get("code") || "");
    if (code.length < 4) {
      return NextResponse.json({ error: "Code ungültig" }, { status: 400 });
    }

    const trip = await prisma.trip.findFirst({
      where: { routeShareCode: code },
      include: {
        legs: { orderBy: { sortOrder: "asc" } },
        owner: { select: { name: true } },
      },
    });
    if (!trip) {
      return NextResponse.json(
        { error: "Route-Code nicht gefunden" },
        { status: 404 }
      );
    }

    const status = routeShareStatus(trip);
    if (!status.ok) {
      return NextResponse.json(
        { error: status.reason || "Route-Code ungültig" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      code,
      title: trip.title,
      ownerName: trip.owner.name,
      startDate: trip.startDate.toISOString(),
      endDate: trip.endDate.toISOString(),
      legs: trip.legs.map((leg) => ({
        name: leg.name,
        location: leg.location,
        startDate: leg.startDate.toISOString(),
        endDate: leg.endDate.toISOString(),
        transport: leg.transport,
        laundryAvailable: leg.laundryAvailable,
      })),
      summary: `${trip.legs.length} Etappen · ${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`,
    });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}

/** Create a new independent trip from a route share code. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser();
    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(
      String((body as { code?: string }).code || "")
    );
    const title =
      typeof (body as { title?: string }).title === "string"
        ? (body as { title: string }).title
        : undefined;

    if (code.length < 4) {
      return NextResponse.json({ error: "Code nötig" }, { status: 400 });
    }

    const source = await prisma.trip.findFirst({
      where: { routeShareCode: code },
      select: { id: true },
    });
    if (!source) {
      return NextResponse.json(
        { error: "Route-Code nicht gefunden" },
        { status: 404 }
      );
    }

    const trip = await createTripFromRouteShare(source.id, user, { title });
    return NextResponse.json(serializeTrip(trip));
  } catch (e) {
    if (e instanceof Error && "status" in e) {
      return NextResponse.json(
        { error: e.message },
        { status: (e as Error & { status: number }).status }
      );
    }
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
