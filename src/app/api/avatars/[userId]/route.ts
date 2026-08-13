import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  const dir = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "avatars");

  for (const [ext, type] of [
    ["webp", "image/webp"],
    ["png", "image/png"],
    ["jpg", "image/jpeg"],
  ] as const) {
    const file = path.join(dir, `${safe}.${ext}`);
    if (fs.existsSync(file)) {
      const buf = fs.readFileSync(file);
      return new NextResponse(buf, {
        headers: {
          "Content-Type": type,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  return new NextResponse(null, { status: 404 });
}
