/**
 * Local category suggestion from item name/notes (no AI).
 * Prefers known packing categories used by the calculator.
 */

export const PACK_CATEGORIES = [
  "Dokumente",
  "Kleidung",
  "Schuhe",
  "Pflege",
  "Gesundheit",
  "Technik",
  "Accessoires",
  "Aktivität",
  "Freizeit",
  "Festlich",
  "Reise",
  "Sonstiges",
] as const;

export type PackCategory = (typeof PACK_CATEGORIES)[number];

type Rule = { category: PackCategory; patterns: RegExp[] };

const RULES: Rule[] = [
  {
    category: "Dokumente",
    patterns: [
      /pass|ausweis|visa|esta|eta|ticket|bordkarte|einreise|formular|versicherungspolice|führerschein|id.?card/i,
    ],
  },
  {
    category: "Gesundheit",
    patterns: [
      /medikament|tablette|pille|erste.?hilfe|pflaster|schmerz|allerg|impfung|seekrank|ingwer|insulin|rezept/i,
    ],
  },
  {
    category: "Pflege",
    patterns: [
      /zahn(bürste|pasta)|shampoo|duschgel|seife|creme|sonnencreme|deodorant|rasier|hygiene|make.?up|kosmetik|haarpflege|lotion|spülung/i,
    ],
  },
  {
    category: "Technik",
    patterns: [
      /ladekabel|netzteil|powerbank|adapter|stecker|handy|laptop|tablet|kopfhörer|kamera|akku|usb|organizer|magnet|lampe|taschenlampe/i,
    ],
  },
  {
    category: "Schuhe",
    patterns: [
      /schuh|sneaker|sandal|flip.?flop|stiefel|pumps|boots|slipper|pantoffel/i,
    ],
  },
  {
    category: "Festlich",
    patterns: [
      /anzug|smoking|abendkleid|cocktail|gala|krawatte|fliege|festlich|abendgarderobe/i,
    ],
  },
  {
    category: "Aktivität",
    patterns: [
      /sport|training|legging|badehose|badeanzug|bikini|schwimmen|yoga|wandern|fitness/i,
    ],
  },
  {
    category: "Freizeit",
    patterns: [/regenjacke|windjacke|softshell|fleece|jacke|mantel|parka/i],
  },
  {
    category: "Accessoires",
    patterns: [
      /hut|cap|mütze|schal|tuch|gürtel|schmuck|clutch|sonnenbrille|regenschirm|schirm|tasche|gurt/i,
    ],
  },
  {
    category: "Kleidung",
    patterns: [
      /shirt|hose|jeans|rock|kleid|unterwäsche|slip|bh|socken|strumpf|pyjama|schlafanzug|lounge|pulli|pullover|bluse|hemd|shorts|top/i,
    ],
  },
  {
    category: "Reise",
    patterns: [
      /nackenkissen|schlafmaske|ohropax|reisekissen|snacks|trinkflasche|gepäck|kofferanhänger/i,
    ],
  },
];

/** Suggest a category from free text; falls back to Sonstiges. */
export function suggestCategory(
  name: string,
  notes?: string | null
): PackCategory {
  const hay = `${name} ${notes || ""}`.trim();
  if (!hay) return "Sonstiges";
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(hay))) return rule.category;
  }
  return "Sonstiges";
}

/** Merge catalog with categories already used on a trip (custom ones included). */
export function categoryOptions(existing: string[] = []): string[] {
  const set = new Set<string>([...PACK_CATEGORIES, ...existing.filter(Boolean)]);
  return Array.from(set).sort((a, b) => a.localeCompare(b, "de-CH"));
}
