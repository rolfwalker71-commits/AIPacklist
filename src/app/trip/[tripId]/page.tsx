import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { serializeTrip, tripInclude, repairStackedPersonalItems } from "@/lib/trip-service";
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

  await repairStackedPersonalItems(tripId);

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: tripInclude,
  });
  if (!trip) notFound();

  return (
    <main className="mx-auto max-w-lg px-4 pb-6 pt-4 md:max-w-3xl md:pt-6">
      <Link href="/" className="text-sm font-semibold text-teal-800">
        ← Reisen
      </Link>
      <div className="mt-3">
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
