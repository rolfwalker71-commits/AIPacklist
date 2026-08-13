type Listener = (event: TripEvent) => void;

export type TripEvent =
  | { type: "item_updated"; tripId: string; itemId: string; payload: unknown }
  | { type: "trip_updated"; tripId: string; payload?: unknown }
  | { type: "member_joined"; tripId: string; payload: unknown };

const listeners = new Map<string, Set<Listener>>();

export function subscribe(tripId: string, listener: Listener) {
  if (!listeners.has(tripId)) listeners.set(tripId, new Set());
  listeners.get(tripId)!.add(listener);
  return () => {
    listeners.get(tripId)?.delete(listener);
  };
}

export function publish(event: TripEvent) {
  const set = listeners.get(event.tripId);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  }
}
