import { NextRequest, NextResponse } from "next/server";
import { createTripFromDraft, serializeTrip } from "@/lib/trip-service";
import { prisma } from "@/lib/db";
import type { TripDraft } from "@/lib/types";
import type { SuitcasePlan } from "@/lib/suitcases";

export async function GET() {
  const trips = await prisma.trip.findMany({
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
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const draft = body.draft as TripDraft;
  const owner = body.owner as {
    id?: string;
    name: string;
    color?: string;
    gender?: "FEMALE" | "MALE" | "UNSPECIFIED";
  };
  const partner = body.partner as
    | {
        name: string;
        color?: string;
        gender?: "FEMALE" | "MALE" | "UNSPECIFIED";
      }
    | undefined;
  const suitcasePlans = body.suitcasePlans as SuitcasePlan[] | undefined;

  if (!draft?.legs?.length || !owner?.name) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const trip = await createTripFromDraft(draft, owner, partner, suitcasePlans);
  return NextResponse.json(serializeTrip(trip));
}
