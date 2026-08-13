import { NextRequest, NextResponse } from "next/server";
import { createTripFromDraft, serializeTrip } from "@/lib/trip-service";
import { prisma } from "@/lib/db";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";
import { tripsForUserWhere } from "@/lib/trip-access";
import type { TripDraft } from "@/lib/types";
import type { SuitcasePlan } from "@/lib/suitcases";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const trips = await prisma.trip.findMany({
      where: tripsForUserWhere(user.id),
      orderBy: { updatedAt: "desc" },
      include: {
        owner: true,
        _count: { select: { items: true, members: true, legs: true } },
      },
      take: 50,
    });

    return NextResponse.json(
      trips.map((t) => ({
        ...t,
        startDate: t.startDate.toISOString(),
        endDate: t.endDate.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }))
    );
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireSessionUser();
    const body = await req.json();
    const draft = body.draft as TripDraft;
    const partner = body.partner as
      | {
          name: string;
          color?: string;
          gender?: "FEMALE" | "MALE" | "UNSPECIFIED";
        }
      | undefined;
    const suitcasePlans = body.suitcasePlans as SuitcasePlan[] | undefined;

    if (!draft?.legs?.length) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Owner is always the logged-in user (ignore client-supplied ids)
    const owner = {
      id: sessionUser.id,
      name: sessionUser.name,
      color: sessionUser.color,
      gender: sessionUser.gender as "FEMALE" | "MALE" | "UNSPECIFIED",
    };

    const trip = await createTripFromDraft(
      draft,
      owner,
      partner,
      suitcasePlans
    );
    return NextResponse.json(serializeTrip(trip));
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
