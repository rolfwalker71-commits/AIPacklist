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
      wantsToken: body.client === "app",
    };
  }

  const form = await req.formData();
  return {
    usernameRaw: String(form.get("username") || ""),
    password: String(form.get("password") || ""),
    next: String(form.get("next") || "/"),
    wantsJson: false,
    wantsToken: false,
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

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { usernameRaw, password, next, wantsJson, wantsToken } =
      await readCredentials(req);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const limitKey = `${ip}|${usernameRaw.trim().toLowerCase()}`;
    if (rateLimited(limitKey)) {
      return NextResponse.json(
        { error: "Zu viele Versuche. Bitte später erneut probieren." },
        { status: 429 }
      );
    }
    const dest = safeNext(next);
    const passwordTrimmed = password.trim();


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


    if (!ok || !user) {
      recordFailure(limitKey);
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
      attempts.delete(limitKey);
      const res = NextResponse.json({
        ok: true,
        ...(wantsToken ? { token } : {}),
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
