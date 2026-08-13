import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = String(body.username || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");

  if (!username || !password) {
    return NextResponse.json(
      { error: "Benutzername und Passwort nötig." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (
    !user ||
    !user.passwordHash ||
    !user.isActive ||
    !verifyPassword(password, user.passwordHash)
  ) {
    return NextResponse.json(
      { error: "Anmeldung fehlgeschlagen." },
      { status: 401 }
    );
  }

  const token = await createSession(user.id);
  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      color: user.color,
      gender: user.gender,
      avatarUrl: user.avatarUrl,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
