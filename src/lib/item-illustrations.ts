import type { PackCategory } from "@/lib/categorize";

const CATEGORY_SLUG: Record<PackCategory, string> = {
  Dokumente: "cat-dokumente",
  Kleidung: "cat-kleidung",
  Schuhe: "cat-schuhe",
  Pflege: "cat-pflege",
  Gesundheit: "cat-gesundheit",
  Technik: "cat-technik",
  Accessoires: "cat-accessoires",
  Aktivität: "cat-aktivitaet",
  Freizeit: "cat-freizeit",
  Festlich: "cat-festlich",
  Reise: "cat-reise",
  Sonstiges: "cat-sonstiges",
};

type Rule = { slug: string; patterns: RegExp[] };

/** Specific catalog names first; first match wins. */
const ITEM_RULES: Rule[] = [
  { slug: "bras", patterns: [/\bbhs?\b|büstenhalter/i] },
  { slug: "menstrual", patterns: [/monatshygiene|hygieneartikel/i] },
  { slug: "haircare", patterns: [/haarpflege|styling/i] },
  { slug: "razor", patterns: [/rasierer|rasierpflege/i] },
  { slug: "toothbrush", patterns: [/zahnbürste/i] },
  { slug: "toothpaste", patterns: [/zahnpasta/i] },
  { slug: "shampoo", patterns: [/duschgel|shampoo/i] },
  { slug: "sunscreen", patterns: [/sonnencreme|spf/i] },
  { slug: "meds", patterns: [/medikamente|tablette/i] },
  { slug: "seasickness", patterns: [/seekrank|ingwer/i] },
  { slug: "first-aid", patterns: [/erste.?hilfe/i] },
  { slug: "passport", patterns: [/reisepass|ausweis/i] },
  { slug: "visa", patterns: [/einreise|esta|eta|\bvisa\b/i] },
  { slug: "tickets", patterns: [/tickets?|bordkarten/i] },
  { slug: "charger", patterns: [/handy-?ladekabel|netzteil/i] },
  { slug: "car-charger", patterns: [/ladekabel auto|autoladekabel/i] },
  { slug: "powerbank", patterns: [/powerbank/i] },
  { slug: "adapter", patterns: [/reiseadapter|adapter/i] },
  { slug: "cabin-organizer", patterns: [/kabinen-?organizer|magnettaschen/i] },
  { slug: "neck-pillow", patterns: [/nackenkissen|schlafmaske/i] },
  { slug: "carryon-checklist", patterns: [/handgepäck-?checkliste|checkliste/i] },
  { slug: "snacks", patterns: [/snacks?/i] },
  { slug: "umbrella", patterns: [/kompaktschirm|regenschirm|\bschirm\b/i] },
  { slug: "sunhat", patterns: [/sonnenhut|\bcap\b/i] },
  { slug: "beanie", patterns: [/mütze|schal|\btuch\b/i] },
  { slug: "clutch", patterns: [/clutch|schmuck/i] },
  { slug: "tie", patterns: [/krawatte|fliege/i] },
  { slug: "formal-accessories", patterns: [/festliche accessoires/i] },
  { slug: "sport-shoes", patterns: [/sportschuhe|laufschuhe|turnschuhe/i] },
  { slug: "dress-shoes", patterns: [/abendschuhe|pumps|formelle|lederschuhe/i] },
  { slug: "sandals", patterns: [/sandalen|flip-?flops?/i] },
  { slug: "everyday-shoes", patterns: [/bequeme schuhe|alltagsschuhe|schuhe alltag/i] },
  { slug: "sport-top", patterns: [/sport-?top|sportshirt/i] },
  { slug: "training-shorts", patterns: [/leggings?|trainingshorts/i] },
  { slug: "swimwear", patterns: [/badehose|badeanzug|bikini|badeshorts/i] },
  { slug: "evening-dress", patterns: [/abendkleid|cocktailkleid|abendgarderobe/i] },
  { slug: "suit", patterns: [/\banzug\b|smoking/i] },
  { slug: "casual-outfits", patterns: [/^lässige outfits/i] },
  { slug: "blouses", patterns: [/blusen|kleider/i] },
  { slug: "shirts", patterns: [/hemden|\bhemd\b/i] },
  { slug: "sleepwear", patterns: [/schlafanzug|loungewear|pyjama|nachthemd/i] },
  { slug: "underwear", patterns: [/unterwäsche|slips?|boxershorts?/i] },
  { slug: "socks", patterns: [/socken|strumpfhose|strümpfe/i] },
  { slug: "shorts", patterns: [/shorts/i] },
  { slug: "longleeves", patterns: [/langarm|layer|zwiebel/i] },
  { slug: "tshirts", patterns: [/t-?shirts?|\btops\b/i] },
  { slug: "pants", patterns: [/hosen|jeans|röcke|\brock\b/i] },
  { slug: "rainjacket", patterns: [/regenjacke/i] },
  { slug: "windjacket", patterns: [/windjacke|softshell/i] },
  { slug: "fleece", patterns: [/fleece|strickjacke/i] },
];

const CATEGORY_FALLBACK = new Map<string, string>(
  Object.entries(CATEGORY_SLUG)
);

export function resolveIllustrationSlug(
  name: string,
  category?: string | null
): string {
  const hay = name.trim();
  if (hay) {
    for (const rule of ITEM_RULES) {
      if (rule.patterns.some((re) => re.test(hay))) return rule.slug;
    }
  }
  const cat = (category || "").trim();
  return CATEGORY_FALLBACK.get(cat) || CATEGORY_SLUG.Sonstiges;
}

export function illustrationSrc(name: string, category?: string | null): string {
  return `/illustrations/${resolveIllustrationSlug(name, category)}.png`;
}

export function packItemImageSrc(
  name: string,
  category?: string | null,
  photoUrl?: string | null
): string {
  return photoUrl || illustrationSrc(name, category);
}
