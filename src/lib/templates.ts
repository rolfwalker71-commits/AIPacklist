import type { TripDraft } from "./types";
import { addDays, formatISO, startOfDay } from "date-fns";

function iso(d: Date) {
  return formatISO(startOfDay(d), { representation: "date" });
}

export interface PackTemplate {
  id: string;
  name: string;
  description: string;
  tagline: string;
  build: (startDate?: string) => TripDraft;
}

function baseStart(startDate?: string) {
  return startDate ? new Date(startDate) : new Date();
}

export const TEMPLATES: PackTemplate[] = [
  {
    id: "cruise-special",
    name: "Kreuzfahrt Spezial",
    description:
      "Lange Seetage ohne Wäsche, Gala-Abende und wechselhaftem Atlantikwetter.",
    tagline: "Schiff · Gala · Deck",
    build: (startDate) => {
      const start = baseStart(startDate);
      const cruiseEnd = addDays(start, 12);
      const landEnd = addDays(cruiseEnd, 5);
      return {
        title: "Kreuzfahrt Spezial",
        startDate: iso(start),
        endDate: iso(landEnd),
        legs: [
          {
            name: "Transatlantik-Kreuzfahrt",
            location: "Transatlantik",
            startDate: iso(start),
            endDate: iso(cruiseEnd),
            transport: "SHIP",
            laundryAvailable: false,
            weatherTags: ["cool_windy", "uncertain"],
            dressCodes: ["gala", "casual", "smart_casual"],
          },
          {
            name: "Landaufenthalt Florida",
            location: "Florida",
            startDate: iso(addDays(cruiseEnd, 1)),
            endDate: iso(landEnd),
            transport: "FLIGHT",
            laundryAvailable: true,
            laundryIntervalDays: 3,
            weatherTags: ["tropical", "hot"],
            dressCodes: ["casual", "sport"],
          },
        ],
      };
    },
  },
  {
    id: "warm-cold",
    name: "Warm-Kalt Übergang",
    description:
      "Zwei Klimazonen in einer Reise – Layering und getrennte Kofferzonen.",
    tagline: "Zwei Klimazonen",
    build: (startDate) => {
      const start = baseStart(startDate);
      const mid = addDays(start, 6);
      const end = addDays(mid, 7);
      return {
        title: "Warm-Kalt Übergang",
        startDate: iso(start),
        endDate: iso(end),
        legs: [
          {
            name: "Städtetrip kühl",
            location: "Europa",
            startDate: iso(start),
            endDate: iso(mid),
            transport: "FLIGHT",
            laundryAvailable: false,
            weatherTags: ["cool_windy", "rainy"],
            dressCodes: ["smart_casual", "casual"],
          },
          {
            name: "Strand & Sonne",
            location: "Mittelmeer",
            startDate: iso(addDays(mid, 1)),
            endDate: iso(end),
            transport: "FLIGHT",
            laundryAvailable: true,
            laundryIntervalDays: 4,
            weatherTags: ["hot", "tropical"],
            dressCodes: ["casual", "sport"],
          },
        ],
      };
    },
  },
  {
    id: "roadtrip",
    name: "Roadtrip",
    description:
      "Flexible Etappen mit Auto, Waschsalons und Freizeit-Ausrüstung.",
    tagline: "Auto · Freedom",
    build: (startDate) => {
      const start = baseStart(startDate);
      const leg2 = addDays(start, 4);
      const leg3 = addDays(leg2, 5);
      const end = addDays(leg3, 4);
      return {
        title: "Roadtrip",
        startDate: iso(start),
        endDate: iso(end),
        legs: [
          {
            name: "Anreise & Küste",
            location: "Europa",
            startDate: iso(start),
            endDate: iso(leg2),
            transport: "CAR",
            laundryAvailable: false,
            weatherTags: ["uncertain"],
            dressCodes: ["casual", "sport"],
          },
          {
            name: "Nationalpark",
            location: "Alpen",
            startDate: iso(addDays(leg2, 1)),
            endDate: iso(leg3),
            transport: "CAR",
            laundryAvailable: true,
            laundryIntervalDays: 5,
            weatherTags: ["cool_windy", "rainy"],
            dressCodes: ["sport", "casual"],
          },
          {
            name: "Rückweg Städte",
            location: "Europa",
            startDate: iso(addDays(leg3, 1)),
            endDate: iso(end),
            transport: "CAR",
            laundryAvailable: true,
            laundryIntervalDays: 3,
            weatherTags: ["hot"],
            dressCodes: ["casual"],
          },
        ],
      };
    },
  },
];

export function getTemplate(id: string) {
  return TEMPLATES.find((t) => t.id === id);
}
