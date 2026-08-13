import { NextRequest, NextResponse } from "next/server";
import {
  claimExistingTripsForAdmin,
  createSession,
  hashPassword,
  needsSetup,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (!(await needsSetup())) {
    return NextResponse.json(
      { error: "Setup bereits erledigt. Bitte anmelden." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const username = String(body.username || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim() || "Admin";

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json(
      {
        error:
          "Benutzername: 3–32 Zeichen, nur a–z, 0–9, Punkt, Unterstrich, Bindestrich.",
      },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Passwort mindestens 8 Zeichen." },
      { status: 400 }
    );
  }

  const admin = await prisma.user.create({
    data: {
      name,
      username,
      passwordHash: hashPassword(password),
      role: "ADMIN",
      color: "#0F766E",
    },
  });

  await claimExistingTripsForAdmin(admin.id);

  const token = await createSession(admin.id);
  const res = NextResponse.json({
    ok: true,
    user: {
      id: admin.id,
      name: admin.name,
      username: admin.username,
      role: admin.role,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
