import { NextRequest, NextResponse } from "next/server";
import { parseVibeWithAi } from "@/lib/ai-parse";
import { buildPackList } from "@/lib/ai-pack";
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

  const profiles =
    travelers.length > 0
      ? travelers
      : [{ key: "t1", name: "Reisende:r", gender: "UNSPECIFIED" as const }];

  const { draft, source, rationale } = await parseVibeWithAi(prompt, startDate);
  const built = await buildPackList({
    legs: draft.legs,
    travelers: profiles,
  });

  return NextResponse.json({
    draft,
    preview: built.items,
    summary: built.laundry,
    parseSource: source,
    packSource: built.source,
    rationale,
    tips: built.tips,
    aiConfigured: isAiConfigured(),
  });
}
