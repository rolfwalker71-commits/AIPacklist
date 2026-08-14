/**
 * Offline pack support: trip snapshots + pack-toggle outbox in IndexedDB.
 * Scope: pack check/uncheck only — not route/AI/team/photos.
 */

const DB_NAME = "flexipack-offline";
const DB_VERSION = 1;
const STORE_TRIPS = "trips";
const STORE_OUTBOX = "outbox";

export type PackOutboxEntry = {
  /** Unique key: `${tripId}:${itemId}` — last intent wins */
  id: string;
  tripId: string;
  itemId: string;
  packed: boolean;
  queuedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB nicht verfügbar"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("IDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TRIPS)) {
        db.createObjectStore(STORE_TRIPS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        const store = db.createObjectStore(STORE_OUTBOX, { keyPath: "id" });
        store.createIndex("tripId", "tripId", { unique: false });
      }
    };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IDB request failed"));
  });
}

export function isBrowserOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

/** Persist full trip JSON for offline reopen while tab/session still has the page. */
export async function saveTripSnapshot(
  tripId: string,
  trip: unknown
): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_TRIPS, "readwrite");
    await idbReq(
      tx.objectStore(STORE_TRIPS).put({
        id: tripId,
        savedAt: Date.now(),
        trip,
      })
    );
    db.close();
  } catch {
    // Offline storage is best-effort
  }
}

export async function loadTripSnapshot<T = unknown>(
  tripId: string
): Promise<T | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_TRIPS, "readonly");
    const row = await idbReq<{ id: string; trip: T } | undefined>(
      tx.objectStore(STORE_TRIPS).get(tripId)
    );
    db.close();
    return row?.trip ?? null;
  } catch {
    return null;
  }
}

export async function enqueuePackToggle(opts: {
  tripId: string;
  itemId: string;
  packed: boolean;
}): Promise<void> {
  const db = await openDb();
  const entry: PackOutboxEntry = {
    id: `${opts.tripId}:${opts.itemId}`,
    tripId: opts.tripId,
    itemId: opts.itemId,
    packed: opts.packed,
    queuedAt: Date.now(),
  };
  const tx = db.transaction(STORE_OUTBOX, "readwrite");
  await idbReq(tx.objectStore(STORE_OUTBOX).put(entry));
  db.close();
}

export async function listOutbox(tripId: string): Promise<PackOutboxEntry[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_OUTBOX, "readonly");
    const store = tx.objectStore(STORE_OUTBOX);
    const index = store.index("tripId");
    const rows = await idbReq<PackOutboxEntry[]>(index.getAll(tripId));
    db.close();
    return (rows || []).sort((a, b) => a.queuedAt - b.queuedAt);
  } catch {
    return [];
  }
}

export async function pendingCount(tripId: string): Promise<number> {
  const rows = await listOutbox(tripId);
  return rows.length;
}

export async function removeOutboxEntry(id: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_OUTBOX, "readwrite");
    await idbReq(tx.objectStore(STORE_OUTBOX).delete(id));
    db.close();
  } catch {
    // ignore
  }
}

export async function clearOutboxForTrip(tripId: string): Promise<void> {
  const rows = await listOutbox(tripId);
  const db = await openDb();
  const tx = db.transaction(STORE_OUTBOX, "readwrite");
  for (const row of rows) {
    tx.objectStore(STORE_OUTBOX).delete(row.id);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getOutboxEntry(id: string): Promise<PackOutboxEntry | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_OUTBOX, "readonly");
    const row = await idbReq<PackOutboxEntry | undefined>(
      tx.objectStore(STORE_OUTBOX).get(id)
    );
    db.close();
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Replay queued pack toggles. Returns how many succeeded.
 * Stops on first hard failure so remaining stay queued.
 * Re-reads each entry before PATCH so a newer online toggle can clear it.
 */
export async function flushPackOutbox(tripId: string): Promise<{
  flushed: number;
  remaining: number;
}> {
  if (!isBrowserOnline()) {
    const remaining = await pendingCount(tripId);
    return { flushed: 0, remaining };
  }

  const rows = await listOutbox(tripId);
  let flushed = 0;

  for (const row of rows) {
    const current = await getOutboxEntry(row.id);
    if (!current) continue;

    try {
      const res = await fetch(`/api/trips/${tripId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          itemId: current.itemId,
          packed: current.packed,
        }),
      });
      if (!res.ok) {
        // Item gone — drop the entry; other errors keep queue
        if (res.status === 404) {
          await removeOutboxEntry(current.id);
          continue;
        }
        break;
      }
      await removeOutboxEntry(current.id);
      flushed += 1;
    } catch {
      break;
    }
  }

  const remaining = await pendingCount(tripId);
  return { flushed, remaining };
}

/** Apply pending outbox intents onto a trip's items (for offline UI consistency). */
export function applyOutboxToItems<
  T extends { id: string; packedAt: string | null },
>(items: T[], outbox: PackOutboxEntry[]): T[] {
  if (!outbox.length) return items;
  const byItem = new Map(outbox.map((o) => [o.itemId, o]));
  return items.map((item) => {
    const o = byItem.get(item.id);
    if (!o) return item;
    return {
      ...item,
      packedAt: o.packed ? item.packedAt || new Date(o.queuedAt).toISOString() : null,
    };
  });
}
