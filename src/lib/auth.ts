import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { AppRole } from "@prisma/client";
import { SESSION_COOKIE } from "@/lib/auth-constants";

export { SESSION_COOKIE };

const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: AppRole;
  color: string;
  gender: string;
  avatarUrl: string | null;
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const test = scryptSync(password, salt, 64);
  if (hashBuf.length !== test.length) return false;
  return timingSafeEqual(hashBuf, test);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function needsSetup(): Promise<boolean> {
  const count = await prisma.user.count({
    where: { username: { not: null }, passwordHash: { not: null } },
  });
  return count === 0;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
    },
  });
  return token;
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function getUserFromToken(
  token: string | undefined | null
): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session
      .delete({ where: { id: session.id } })
      .catch(() => undefined);
    return null;
  }
  if (!session.user.isActive || !session.user.username) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    username: session.user.username,
    role: session.user.role,
    color: session.user.color,
    gender: session.user.gender,
    avatarUrl: session.user.avatarUrl,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return getUserFromToken(token);
}

export function sessionCookieOptions(maxAgeSec = SESSION_DAYS * 24 * 60 * 60) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Nicht angemeldet", 401);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (user.role !== "ADMIN") throw new AuthError("Nur für Admins", 403);
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function authErrorResponse(e: unknown) {
  if (e instanceof AuthError) {
    return { error: e.message, status: e.status };
  }
  return { error: "Auth-Fehler", status: 500 };
}

/** After first admin setup: attach existing trips so nothing is orphaned. */
export async function claimExistingTripsForAdmin(adminId: string) {
  const trips = await prisma.trip.findMany({ select: { id: true, ownerId: true } });
  for (const trip of trips) {
    await prisma.tripMember.upsert({
      where: {
        tripId_userId: { tripId: trip.id, userId: adminId },
      },
      create: { tripId: trip.id, userId: adminId, role: "OWNER" },
      update: { role: "OWNER" },
    });
    if (trip.ownerId !== adminId) {
      await prisma.trip.update({
        where: { id: trip.id },
        data: { ownerId: adminId },
      });
      // Keep previous owner as partner if different person record
      if (trip.ownerId) {
        await prisma.tripMember.upsert({
          where: {
            tripId_userId: { tripId: trip.id, userId: trip.ownerId },
          },
          create: {
            tripId: trip.id,
            userId: trip.ownerId,
            role: "PARTNER",
          },
          update: {},
        });
      }
    }
  }
}
