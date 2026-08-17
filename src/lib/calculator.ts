import { differenceInCalendarDays, getMonth, parseISO } from "date-fns";
import type {
  CalculatedItem,
  LegInput,
  PackGender,
  TravelerProfile,
  WeatherTag,
} from "./types";
import { inferPriority } from "./priority";
import { expandPersonalItems } from "./pack-ownership";

function legDays(leg: LegInput): number {
  const start = parseISO(leg.startDate);
  const end = parseISO(leg.endDate);
  return Math.max(1, differenceInCalendarDays(end, start) + 1);
}

/**
 * Sum consecutive days across legs without laundry access.
 * When laundry is available, the streak resets (and interval can cap needed items).
 */
export function daysWithoutLaundry(legs: LegInput[]): number {
  let maxStreak = 0;
  let current = 0;

  for (const leg of legs) {
    const days = legDays(leg);
    if (!leg.laundryAvailable) {
      current += days;
      maxStreak = Math.max(maxStreak, current);
    } else {
      const interval = leg.laundryIntervalDays ?? 7;
      maxStreak = Math.max(maxStreak, Math.min(days, interval));
      current = 0;
    }
  }

  return Math.max(1, maxStreak);
}

function hasAtlanticShipInAutumn(legs: LegInput[]): boolean {
  return legs.some((leg) => {
    if (leg.transport !== "SHIP") return false;
    const name = leg.name.toLowerCase();
    const atlanticHint =
      name.includes("atlantik") ||
      name.includes("atlantic") ||
      name.includes("transatlantik") ||
      name.includes("transatlantic") ||
      name.includes("kreuzfahrt") ||
      name.includes("cruise");
    const month = getMonth(parseISO(leg.startDate));
    const autumn = month >= 8 && month <= 10;
    const cool =
      leg.weatherTags.includes("cool_windy") ||
      leg.weatherTags.includes("uncertain") ||
      leg.weatherTags.includes("cold");
    return atlanticHint || (autumn && cool);
  });
}

function countGalaEvents(legs: LegInput[]): number {
  let total = 0;
  for (const leg of legs) {
    if (!leg.dressCodes.includes("gala")) continue;
    const days = legDays(leg);
    total += Math.max(1, Math.ceil(days / 7));
  }
  return total;
}

function hasTag(legs: LegInput[], tag: WeatherTag): boolean {
  return legs.some((l) => l.weatherTags.includes(tag));
}

function hasDress(legs: LegInput[], code: string): boolean {
  return legs.some((l) => l.dressCodes.includes(code as never));
}

function hasTransport(legs: LegInput[], t: string): boolean {
  return legs.some((l) => l.transport === t);
}

export function personalItemsForTraveler(
  legs: LegInput[],
  traveler: TravelerProfile,
  noLaundryDays: number,
  reserve: number
): CalculatedItem[] {
  const gender: PackGender = traveler.gender || "UNSPECIFIED";
  const baseUnderwear = noLaundryDays + reserve;
  const forName = `für ${traveler.name}`;
  const items: CalculatedItem[] = [];

  const push = (
    name: string,
    category: string,
    quantity: number,
    opts?: Partial<CalculatedItem>
  ) => {
    const extraNotes = opts?.notes;
    const notes = extraNotes ? `${forName} · ${extraNotes}` : forName;
    items.push({
      name,
      category,
      quantity,
      isShared: false,
      source: "calculator",
      assigneeKey: traveler.key,
      ...opts,
      notes,
      priority: opts?.priority || inferPriority(name, category, notes),
    });
  };

  if (gender === "FEMALE") {
    push("Slips / Unterwäsche", "Kleidung", baseUnderwear, {
      notes: `${noLaundryDays} Tage ohne Wäsche + ${reserve} Reserve`,
    });
    push("BHs", "Kleidung", Math.min(baseUnderwear, Math.ceil(baseUnderwear * 0.7) + 1));
    push("Tops / T-Shirts", "Kleidung", baseUnderwear);
    push("Hosen / Jeans / Röcke", "Kleidung", Math.min(4, Math.ceil(noLaundryDays / 3) + 1));
    push("Schlafanzug / Loungewear", "Kleidung", Math.min(2, Math.ceil(noLaundryDays / 7)));
    push("Strumpfhose / Socken", "Kleidung", Math.ceil(baseUnderwear / 2));
  } else if (gender === "MALE") {
    push("Boxershorts / Unterwäsche", "Kleidung", baseUnderwear, {
      notes: `${noLaundryDays} Tage ohne Wäsche + ${reserve} Reserve`,
    });
    push("Socken", "Kleidung", baseUnderwear);
    push("T-Shirts", "Kleidung", baseUnderwear);
    push("Hosen / Jeans", "Kleidung", Math.min(4, Math.ceil(noLaundryDays / 3) + 1));
    push("Schlafanzug / Loungewear", "Kleidung", Math.min(2, Math.ceil(noLaundryDays / 7)));
  } else {
    push("Unterwäsche", "Kleidung", baseUnderwear, {
      notes: `${noLaundryDays} Tage ohne Wäsche + ${reserve} Reserve`,
    });
    push("Socken", "Kleidung", baseUnderwear);
    push("T-Shirts / Tops", "Kleidung", baseUnderwear);
    push("Hosen / Jeans", "Kleidung", Math.min(4, Math.ceil(noLaundryDays / 3) + 1));
    push("Schlafanzug / Loungewear", "Kleidung", Math.min(2, Math.ceil(noLaundryDays / 7)));
  }

  if (hasTag(legs, "tropical") || hasTag(legs, "hot")) {
    push(
      gender === "FEMALE" ? "Shorts / leichte Röcke" : "Shorts",
      "Kleidung",
      Math.min(4, Math.ceil(noLaundryDays / 3))
    );
    push(
      gender === "FEMALE"
        ? "Badeanzug / Bikini"
        : gender === "MALE"
          ? "Badehose"
          : "Badehose / Badeanzug",
      "Aktivität",
      2
    );
    push("Sonnenhut / Cap", "Accessoires", 1);
    push(
      gender === "FEMALE" ? "Sandalen / Flip-Flops" : "Flip-Flops / Sandalen",
      "Schuhe",
      1
    );
  }

  if (
    hasTag(legs, "cool_windy") ||
    hasTag(legs, "cold") ||
    hasAtlanticShipInAutumn(legs)
  ) {
    push(
      "Langarmshirts / Layer",
      "Kleidung",
      Math.min(4, Math.ceil(noLaundryDays / 3) + 1),
      { notes: "Zwiebellook für Deck/Kühlwetter" }
    );
    push("Windjacke / Softshell", "Freizeit", 1, {
      notes: "Atlantik-/Seewetter",
    });
    push(
      gender === "FEMALE" ? "Mütze, Schal oder Tuch" : "Mütze oder Tuch",
      "Accessoires",
      1,
      { notes: "Für windiges Deck" }
    );
    push("Leichte Fleece-/Strickjacke", "Kleidung", 1);
  }

  if (hasTag(legs, "uncertain") || hasTag(legs, "rainy")) {
    push("Packbare Regenjacke", "Freizeit", 1);
  }

  const gala = countGalaEvents(legs);
  if (gala > 0) {
    if (gender === "FEMALE") {
      push("Abendkleid / Cocktailkleid", "Festlich", Math.min(gala, 2), {
        notes: `${gala} Gala-Abend(e)`,
      });
      push("Abendschuhe / Pumps", "Schuhe", 1);
      push("Schmuck / Clutch", "Accessoires", 1);
    } else if (gender === "MALE") {
      push("Anzug / Smoking", "Festlich", Math.min(gala, 2), {
        notes: `${gala} Gala-Abend(e)`,
      });
      push("Formelle Lederschuhe", "Schuhe", 1);
      push("Krawatte / Fliege", "Accessoires", 1);
    } else {
      push("Abendgarderobe (Anzug / Abendkleid)", "Festlich", Math.min(gala, 2), {
        notes: `${gala} Gala-Abend(e)`,
      });
      push("Formelle Schuhe", "Schuhe", 1);
      push("Festliche Accessoires", "Accessoires", 1);
    }
  }

  if (hasDress(legs, "sport")) {
    push("Sportschuhe", "Schuhe", 1);
    push(
      gender === "FEMALE" ? "Sport-Top" : "Sportshirt",
      "Aktivität",
      Math.min(3, Math.ceil(noLaundryDays / 4))
    );
    push(
      gender === "FEMALE" ? "Leggings / Trainingshorts" : "Trainingshorts",
      "Aktivität",
      2
    );
  }

  if (hasDress(legs, "casual") || hasDress(legs, "smart_casual")) {
    push(
      gender === "FEMALE"
        ? "Blusen / Kleider / lässige Outfits"
        : gender === "MALE"
          ? "Hemden / lässige Outfits"
          : "Lässige Outfits (Hemd / Bluse)",
      "Kleidung",
      Math.min(3, Math.ceil(noLaundryDays / 4))
    );
  }

  // Gender-specific toiletries (personal, not shared)
  if (gender === "FEMALE") {
    push("Haarpflege / Styling", "Pflege", 1);
    if (noLaundryDays >= 5) {
      push("Hygieneartikel (Monatshygiene)", "Pflege", 1);
    }
  } else if (gender === "MALE") {
    push("Rasierer / Rasierpflege", "Pflege", 1);
  }

  push("Medikamente (persönlich)", "Gesundheit", 1);
  push("Zahnbürste", "Pflege", 1);
  push("Handy-Ladekabel / Netzteil", "Technik", 1);
  push("Powerbank", "Technik", 1);
  push("Bequeme Schuhe Alltag", "Schuhe", 1);

  // Personal documents & entry paperwork — never shared
  push("Reisepass / Ausweis", "Dokumente", 1);
  push("Tickets / Bordkarten (persönlich)", "Dokumente", 1);
  if (hasTransport(legs, "FLIGHT") || hasTransport(legs, "SHIP")) {
    push("Einreiseformulare (ESTA / ETA / Visa)", "Dokumente", 1, {
      notes: "Persönlich ausfüllen und mitführen",
    });
    push("Reiseadapter", "Technik", 1);
  }

  return items;
}

export function calculatePackList(
  legs: LegInput[],
  travelers?: TravelerProfile[]
): CalculatedItem[] {
  if (!legs.length) return [];

  const noLaundryDays = daysWithoutLaundry(legs);
  const reserve = noLaundryDays >= 10 ? 2 : 1;
  const profiles =
    travelers && travelers.length > 0
      ? travelers
      : [
          {
            key: "traveler-1",
            name: "Reisende:r",
            gender: "UNSPECIFIED" as PackGender,
          },
        ];

  const items: CalculatedItem[] = [];

  const pushShared = (
    name: string,
    category: string,
    quantity: number,
    opts?: Partial<CalculatedItem>
  ) => {
    items.push({
      name,
      category,
      quantity,
      isShared: true,
      source: "calculator",
      assigneeKey: "shared",
      ...opts,
      priority:
        opts?.priority || inferPriority(name, category, opts?.notes),
    });
  };

  for (const traveler of profiles) {
    items.push(
      ...personalItemsForTraveler(legs, traveler, noLaundryDays, reserve)
    );
  }

  // Shared couple / group essentials (nur wirklich Teilbare)
  if (hasTag(legs, "tropical") || hasTag(legs, "hot")) {
    pushShared("Sonnencreme SPF50", "Pflege", 1);
  }
  if (hasTag(legs, "uncertain") || hasTag(legs, "rainy")) {
    pushShared("Kompaktschirm", "Accessoires", 1);
  }
  if (hasTransport(legs, "SHIP")) {
    pushShared("Seekrankheitsmittel / Ingwer", "Gesundheit", 1);
    pushShared("Kabinen-Organizer / Magnettaschen", "Technik", 1);
  }
  if (hasTransport(legs, "FLIGHT")) {
    pushShared("Nackenkissen / Schlafmaske (gemeinsam)", "Reise", 1);
    pushShared("Handgepäck-Checkliste", "Reise", 1);
  }
  if (hasTransport(legs, "CAR")) {
    pushShared("Ladekabel Auto", "Technik", 1);
    pushShared("Snacks für unterwegs", "Reise", 1);
  }

  pushShared("Duschgel / Shampoo", "Pflege", 1);
  pushShared("Zahnpasta", "Pflege", 1);
  pushShared("Erste-Hilfe-Mini", "Gesundheit", 1);

  return expandPersonalItems(items, profiles);
}

export function summarizeLaundry(legs: LegInput[]) {
  return {
    daysWithoutLaundry: daysWithoutLaundry(legs),
    totalDays: legs.reduce((sum, l) => sum + legDays(l), 0),
    galaEvents: countGalaEvents(legs),
    atlanticAutumn: hasAtlanticShipInAutumn(legs),
  };
}
