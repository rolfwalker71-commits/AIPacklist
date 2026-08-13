export type Transport = "SHIP" | "FLIGHT" | "CAR" | "TRAIN" | "OTHER";

export type WeatherTag =
  | "cool_windy"
  | "tropical"
  | "uncertain"
  | "cold"
  | "hot"
  | "rainy";

export type DressCode = "gala" | "casual" | "sport" | "smart_casual";

export type PackGender = "FEMALE" | "MALE" | "UNSPECIFIED";

export interface TravelerProfile {
  key: string;
  name: string;
  gender: PackGender;
  color?: string;
}

export interface LegInput {
  name: string;
  /** Rough region/destination, e.g. Florida, Karibik, Transatlantik */
  location?: string | null;
  startDate: string; // ISO date
  endDate: string;
  transport: Transport;
  laundryAvailable: boolean;
  laundryIntervalDays?: number | null;
  weatherTags: WeatherTag[];
  dressCodes: DressCode[];
}

export interface CalculatedItem {
  name: string;
  category: string;
  quantity: number;
  isShared: boolean;
  priority?: "EARLY" | "NORMAL" | "DAY_OF";
  notes?: string;
  source: "calculator" | "template" | "manual" | "ai";
  /** Traveler key for personal items; undefined/shared for shared */
  assigneeKey?: string;
}

export interface TripDraft {
  title: string;
  startDate: string;
  endDate: string;
  legs: LegInput[];
  travelers?: TravelerProfile[];
}
