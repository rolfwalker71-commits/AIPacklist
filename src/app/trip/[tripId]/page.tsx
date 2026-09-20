import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  serializeTrip,
  tripInclude,
  backfillItemOwners,
  repairGenderedPackItems,
  repairStackedPersonalItems,
} from "@/lib/trip-service";
import { TripWorkspace } from "@/components/trip/trip-workspace";
import { getSessionUser } from "@/lib/auth";
import { userCanAccessTrip } from "@/lib/trip-access";

export const dynamic = "force-dynamic";

export default async function TripPage({
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
  await repairStackedPersonalItems(tripId);
  await repairGenderedPackItems(tripId);

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: tripInclude,
  });
  if (!trip) notFound();

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-6 pt-6 md:max-w-3xl md:pt-8 lg:max-w-6xl pad:pl-[17rem] pad:pr-6 lg:pr-8">
      <div>
        <TripWorkspace
          initialTrip={serializeTrip(trip)}
          sessionUser={{
            id: user.id,
            name: user.name,
            color: user.color,
            gender: user.gender as "FEMALE" | "MALE" | "UNSPECIFIED",
            avatarUrl: user.avatarUrl,
            role: user.role,
            username: user.username,
          }}
        />
      </div>
    </main>
  );
}
