import { NextRequest, NextResponse } from "next/server";
import {
  getOpenAiModel,
  isAiConfigured,
  maskKey,
  getOpenAiApiKey,
  readAiSettings,
  writeAiSettings,
} from "@/lib/openai";

export async function GET() {
  const key = getOpenAiApiKey();
  const settings = readAiSettings();
  return NextResponse.json({
    configured: isAiConfigured(),
    source: process.env.OPENAI_API_KEY?.trim()
      ? "env"
      : settings.openaiApiKey
        ? "settings"
        : "none",
    maskedKey: maskKey(key),
    model: getOpenAiModel(),
    features: [
      "KI-Freitext → Etappen erkennen",
      "Packliste mit KI verfeinern",
      "Reise-Tipps",
    ],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const openaiApiKey =
    typeof body.openaiApiKey === "string" ? body.openaiApiKey.trim() : undefined;
  const model = typeof body.model === "string" ? body.model.trim() : undefined;

  const saved = writeAiSettings({
    ...(openaiApiKey !== undefined ? { openaiApiKey } : {}),
    ...(model !== undefined ? { model: model || "gpt-4.1-mini" } : {}),
  });

  return NextResponse.json({
    ok: true,
    configured: isAiConfigured(),
    maskedKey: maskKey(getOpenAiApiKey()),
    model: saved.model || getOpenAiModel(),
    note: process.env.OPENAI_API_KEY?.trim()
      ? "OPENAI_API_KEY aus der Umgebung hat Vorrang vor dem Schlüssel in den Einstellungen."
      : undefined,
  });
}
