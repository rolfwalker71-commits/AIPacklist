import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Local-only emergency login. Never enabled in production.
 * GET /api/auth/dev-bypass → session cookie + redirect home
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Nicht verfügbar" }, { status: 404 });
  }

  const user =
    (await prisma.user.findUnique({ where: { username: "rolf" } })) ||
    (await prisma.user.findFirst({
      where: { role: "ADMIN", passwordHash: { not: null } },
    }));

  if (!user) {
    return NextResponse.redirect(
      new URL("/login.html?error=server", req.url),
      303
    );
  }

  const token = await createSession(user.id);
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: "/" },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
