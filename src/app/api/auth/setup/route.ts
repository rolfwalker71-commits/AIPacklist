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

async function readBody(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await req.json();
    return {
      username: String(body.username || "")
        .trim()
        .toLowerCase(),
      password: String(body.password || ""),
      name: String(body.name || "").trim() || "Admin",
      next: String(body.next || "/"),
      wantsJson: true,
    };
  }
  const form = await req.formData();
  return {
    username: String(form.get("username") || "")
      .trim()
      .toLowerCase(),
    password: String(form.get("password") || ""),
    name: String(form.get("name") || "").trim() || "Admin",
    next: String(form.get("next") || "/"),
    wantsJson: false,
  };
}

function safeNext(raw: string) {
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export async function POST(req: NextRequest) {
  try {
    if (!(await needsSetup())) {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return NextResponse.json(
          { error: "Setup bereits erledigt. Bitte anmelden." },
          { status: 400 }
        );
      }
      return new NextResponse(null, {
        status: 303,
        headers: { Location: "/login.html" },
      });
    }

    const { username, password, name, next, wantsJson } = await readBody(req);

    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      if (wantsJson) {
        return NextResponse.json(
          {
            error:
              "Benutzername: 3–32 Zeichen, nur a–z, 0–9, Punkt, Unterstrich, Bindestrich.",
          },
          { status: 400 }
        );
      }
      return new NextResponse(null, {
        status: 303,
        headers: { Location: "/login.html?error=missing" },
      });
    }
    if (password.length < 8) {
      if (wantsJson) {
        return NextResponse.json(
          { error: "Passwort mindestens 8 Zeichen." },
          { status: 400 }
        );
      }
      return new NextResponse(null, {
        status: 303,
        headers: { Location: "/login.html?error=missing" },
      });
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
    const dest = safeNext(next);

    if (wantsJson) {
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

    const res = new NextResponse(null, {
      status: 303,
      headers: { Location: dest },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("setup failed", e);
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
    }
    return new NextResponse(null, {
      status: 303,
      headers: { Location: "/login.html?error=server" },
    });
  }
}
