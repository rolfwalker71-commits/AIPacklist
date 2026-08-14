import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

async function readCredentials(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await req.json();
    return {
      usernameRaw: String(body.username || ""),
      password: String(body.password || ""),
      next: String(body.next || "/"),
      wantsJson: true,
    };
  }

  const form = await req.formData();
  return {
    usernameRaw: String(form.get("username") || ""),
    password: String(form.get("password") || ""),
    next: String(form.get("next") || "/"),
    wantsJson: false,
  };
}

function safeNext(raw: string) {
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

function loginErrorRedirect(req: NextRequest, code: string, next: string) {
  const url = new URL("/login.html", req.url);
  url.searchParams.set("error", code);
  if (next && next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url, 303);
}

async function resolveUser(usernameRaw: string) {
  const key = usernameRaw.trim().toLowerCase();
  if (!key) return null;

  const byUsername = await prisma.user.findUnique({ where: { username: key } });
  if (byUsername?.passwordHash && byUsername.isActive) return byUsername;

  const withPassword = await prisma.user.findMany({
    where: { isActive: true, username: { not: null } },
  });
  return (
    withPassword.find(
      (u) =>
        !!u.passwordHash &&
        (u.username === key || u.name.trim().toLowerCase() === key)
    ) || null
  );
}

export async function POST(req: NextRequest) {
  try {
    const { usernameRaw, password, next, wantsJson } = await readCredentials(req);
    const dest = safeNext(next);
    const passwordTrimmed = password.trim();

    console.info("[login]", {
      usernameRaw,
      usernameLen: usernameRaw.trim().length,
      passwordLen: passwordTrimmed.length,
      host: req.headers.get("host"),
    });

    if (!usernameRaw.trim() || !passwordTrimmed) {
      if (wantsJson) {
        return NextResponse.json(
          { error: "Benutzername und Passwort nötig." },
          { status: 400 }
        );
      }
      return loginErrorRedirect(req, "missing", dest);
    }

    const user = await resolveUser(usernameRaw);
    const ok =
      !!user &&
      !!user.passwordHash &&
      user.isActive &&
      verifyPassword(passwordTrimmed, user.passwordHash);

    console.info("[login] result", {
      found: !!user,
      userId: user?.id,
      username: user?.username,
      ok,
    });

    if (!ok || !user) {
      if (wantsJson) {
        return NextResponse.json(
          { error: "Anmeldung fehlgeschlagen." },
          { status: 401 }
        );
      }
      return loginErrorRedirect(req, "auth", dest);
    }

    const token = await createSession(user.id);

    if (wantsJson) {
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

    const res = new NextResponse(null, {
      status: 303,
      headers: { Location: dest },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (e) {
    console.error("login failed", e);
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return NextResponse.json({ error: "Serverfehler beim Login." }, { status: 500 });
    }
    return loginErrorRedirect(req, "server", "/");
  }
}
