export type AiGuide = {
  title: string;
  body: string;
};

export type AiInsights = {
  tips: string[];
  guides: AiGuide[];
  updatedAt?: string | null;
};

export function emptyInsights(): AiInsights {
  return { tips: [], guides: [], updatedAt: null };
}

export function parseAiInsights(raw: string | null | undefined): AiInsights {
  if (!raw) return emptyInsights();
  try {
    const parsed = JSON.parse(raw) as Partial<AiInsights>;
    return {
      tips: Array.isArray(parsed.tips)
        ? parsed.tips.map(String).filter(Boolean)
        : [],
      guides: Array.isArray(parsed.guides)
        ? parsed.guides
            .filter((g) => g && typeof g === "object")
            .map((g) => ({
              title: String((g as AiGuide).title || "Hinweis").slice(0, 120),
              body: String((g as AiGuide).body || "").slice(0, 5000),
            }))
            .filter((g) => g.body)
        : [],
      updatedAt: parsed.updatedAt ? String(parsed.updatedAt) : null,
    };
  } catch {
    return emptyInsights();
  }
}

export function stringifyAiInsights(insights: AiInsights): string {
  return JSON.stringify({
    tips: insights.tips.slice(0, 24),
    guides: insights.guides.slice(0, 12),
    updatedAt: insights.updatedAt || new Date().toISOString(),
  });
}

export function mergeInsights(
  current: AiInsights,
  incoming: Partial<AiInsights>
): AiInsights {
  const tips = incoming.tips?.length ? incoming.tips : current.tips;
  const guides = incoming.guides?.length ? incoming.guides : current.guides;
  return {
    tips: tips.map(String).slice(0, 24),
    guides: (guides || []).slice(0, 12),
    updatedAt: new Date().toISOString(),
  };
}
