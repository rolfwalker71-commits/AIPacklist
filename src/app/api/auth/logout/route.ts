import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  destroySession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  await destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  return res;
}
