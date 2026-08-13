import fs from "fs";
import path from "path";
import OpenAI from "openai";

export type AiSettings = {
  openaiApiKey?: string;
  model?: string;
};

function settingsPath() {
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "data",
    "ai-settings.json"
  );
}

export function readAiSettings(): AiSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    return JSON.parse(raw) as AiSettings;
  } catch {
    return {};
  }
}

export function writeAiSettings(patch: AiSettings): AiSettings {
  const current = readAiSettings();
  const next: AiSettings = {
    ...current,
    ...patch,
  };
  if (patch.openaiApiKey === "") {
    delete next.openaiApiKey;
  }
  const dir = path.dirname(settingsPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function getOpenAiApiKey(): string | null {
  const fromEnv = process.env.OPENAI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const fromFile = readAiSettings().openaiApiKey?.trim();
  return fromFile || null;
}

export function getOpenAiModel(): string {
  return (
    process.env.OPENAI_MODEL?.trim() ||
    readAiSettings().model?.trim() ||
    "gpt-4.1-mini"
  );
}

export function isAiConfigured(): boolean {
  return Boolean(getOpenAiApiKey());
}

export function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length < 8) return "••••";
  return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}

export function getOpenAiClient(): OpenAI | null {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export async function aiJsonCompletion<T>(args: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<T> {
  const client = getOpenAiClient();
  if (!client) {
    throw new Error("OPENAI_API_KEY fehlt");
  }

  const response = await client.chat.completions.create({
    model: getOpenAiModel(),
    temperature: args.temperature ?? 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Leere AI-Antwort");
  return JSON.parse(content) as T;
}
