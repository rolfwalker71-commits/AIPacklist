import {
  createSession,
  hashPassword,
  needsSetup,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function safeNext(raw: FormDataEntryValue | null) {
  const next = String(raw || "/");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function loginAction(formData: FormData) {
  "use server";

  const username = String(formData.get("username") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const next = safeNext(formData.get("next"));

  if (!username || !password) {
    redirect("/login?error=missing");
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (
    !user ||
    !user.passwordHash ||
    !user.isActive ||
    !verifyPassword(password, user.passwordHash)
  ) {
    redirect(`/login?error=auth&next=${encodeURIComponent(next)}`);
  }

  const token = await createSession(user.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
  redirect(next);
}

export async function setupAction(formData: FormData) {
  "use server";

  if (!(await needsSetup())) {
    redirect("/login");
  }

  const username = String(formData.get("username") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim() || "Admin";
  const next = safeNext(formData.get("next"));

  if (!/^[a-z0-9._-]{3,32}$/.test(username) || password.length < 8) {
    redirect("/login?error=missing");
  }

  const { claimExistingTripsForAdmin } = await import("@/lib/auth");

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
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
  redirect(next);
}
