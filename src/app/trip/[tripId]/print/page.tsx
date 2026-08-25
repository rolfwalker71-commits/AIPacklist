import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  serializeTrip,
  tripInclude,
  backfillItemOwners,
} from "@/lib/trip-service";
import { getSessionUser } from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";
import { PrintTripView } from "@/components/trip/print-trip-view";

export const dynamic = "force-dynamic";

export default async function TripPrintPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { tripId } = await params;
  if (!(await userCanAccessTrip(user.id, tripId))) {
    notFound();
  }

  await backfillItemOwners(tripId);

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: tripInclude,
  });
  if (!trip) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:px-0">
      <div className="mb-4 print:hidden">
        <Link href={`/trip/${tripId}`} className="text-sm font-semibold text-teal-800">
          ← Zurück zur Reise
        </Link>
      </div>
      <PrintTripView trip={serializeTrip(trip)} />
    </main>
  );
}
