import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    await requireSessionUser();
    const key = getVapidPublicKey();
    if (!key) {
      return NextResponse.json(
        { error: "Push ist nicht konfiguriert (VAPID)." },
        { status: 503 }
      );
    }
    return NextResponse.json({ publicKey: key });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
