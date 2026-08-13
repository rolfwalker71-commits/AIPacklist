import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { serializeTrip, tripInclude } from "@/lib/trip-service";
import { TripWorkspace } from "@/components/trip/trip-workspace";

export const dynamic = "force-dynamic";

export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: tripInclude,
  });
  if (!trip) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-8">
      <Link href="/" className="text-sm font-semibold text-teal-800">
        ← FlexiPack
      </Link>
      <div className="mt-4">
        <TripWorkspace initialTrip={serializeTrip(trip)} />
      </div>
    </main>
  );
}
