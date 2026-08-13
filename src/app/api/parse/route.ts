import { NextRequest, NextResponse } from "next/server";
import { parseVibeWithAi } from "@/lib/ai-parse";
import { enrichPackListWithAi } from "@/lib/ai-pack";
import { calculatePackList, summarizeLaundry } from "@/lib/calculator";
import { isAiConfigured } from "@/lib/openai";
import type { TravelerProfile } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const prompt = String(body.prompt || "").trim();
  const startDate = body.startDate as string | undefined;
  const travelers = (body.travelers || []) as TravelerProfile[];

  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const { draft, source, rationale } = await parseVibeWithAi(prompt, startDate);
  const base = calculatePackList(draft.legs, travelers);
  const enriched = await enrichPackListWithAi({
    legs: draft.legs,
    travelers:
      travelers.length > 0
        ? travelers
        : [{ key: "t1", name: "Reisende:r", gender: "UNSPECIFIED" }],
    existing: base,
  });

  const preview = [...base, ...enriched.items];
  const summary = summarizeLaundry(draft.legs);

  return NextResponse.json({
    draft,
    preview,
    summary,
    parseSource: source,
    enrichSource: enriched.source,
    rationale,
    tips: enriched.tips,
    aiConfigured: isAiConfigured(),
  });
}
