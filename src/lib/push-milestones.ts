import { prisma } from "@/lib/db";
import { computePackProgress } from "@/lib/pack-progress";
import { notifyTripMembers } from "@/lib/push";
import { tripInclude } from "@/lib/trip-service";

/**
 * After a pack toggle: if progress newly crosses 50% or 100%, push the group.
 * If progress drops below a threshold, clear the flag so it can fire again later.
 */
export async function maybeNotifyPackMilestones(tripId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: tripInclude,
  });
  if (!trip || trip.items.length === 0) return;

  const progress = computePackProgress(trip.items, trip);
  const data: {
    pushMilestone50At?: Date | null;
    pushMilestone100At?: Date | null;
  } = {};

  if (progress.pct >= 100 && !trip.pushMilestone100At) {
    data.pushMilestone100At = new Date();
    if (!trip.pushMilestone50At) data.pushMilestone50At = new Date();
    await notifyTripMembers(tripId, {
      title: trip.title.slice(0, 50),
      body: "Alles gepackt — bereit für die Reise.",
      url: `/trip/${tripId}`,
      tag: `milestone-100-${tripId}`,
    });
  } else if (progress.pct >= 50 && !trip.pushMilestone50At) {
    data.pushMilestone50At = new Date();
    await notifyTripMembers(tripId, {
      title: trip.title.slice(0, 50),
      body: `Zur Hälfte gepackt (${progress.packed}/${progress.total}).`,
      url: `/trip/${tripId}`,
      tag: `milestone-50-${tripId}`,
    });
  }

  if (progress.pct < 50 && trip.pushMilestone50At) {
    data.pushMilestone50At = null;
  }
  if (progress.pct < 100 && trip.pushMilestone100At) {
    data.pushMilestone100At = null;
  }

  if (Object.keys(data).length) {
    await prisma.trip.update({ where: { id: tripId }, data });
  }
}
