import { NextRequest, NextResponse } from "next/server";
import { parseVibePrompt } from "@/lib/vibe-parser";
import { calculatePackList, summarizeLaundry } from "@/lib/calculator";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const prompt = String(body.prompt || "").trim();
  const startDate = body.startDate as string | undefined;

  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const draft = parseVibePrompt(prompt, startDate);
  const preview = calculatePackList(draft.legs);
  const summary = summarizeLaundry(draft.legs);

  return NextResponse.json({ draft, preview, summary });
}
