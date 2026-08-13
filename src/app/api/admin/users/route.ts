import { NextRequest, NextResponse } from "next/server";
import {
  authErrorResponse,
  hashPassword,
  requireAdmin,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { USER_COLORS } from "@/lib/utils";

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      where: { username: { not: null } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        color: true,
        gender: true,
        createdAt: true,
        _count: { select: { memberships: true, ownedTrips: true } },
      },
    });
    return NextResponse.json({ users });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const username = String(body.username || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const role = body.role === "ADMIN" ? "ADMIN" : "USER";

    if (!name) {
      return NextResponse.json({ error: "Name nötig." }, { status: 400 });
    }
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

    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) {
      return NextResponse.json(
        { error: "Benutzername bereits vergeben." },
        { status: 409 }
      );
    }

    const count = await prisma.user.count({
      where: { username: { not: null } },
    });
    const color = USER_COLORS[count % USER_COLORS.length];

    const user = await prisma.user.create({
      data: {
        name,
        username,
        passwordHash: hashPassword(password),
        role,
        color,
        gender: body.gender || "UNSPECIFIED",
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        color: true,
      },
    });

    return NextResponse.json({ user });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const userId = String(body.userId || "");
    if (!userId) {
      return NextResponse.json({ error: "userId nötig" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target?.username) {
      return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
    }

    const data: {
      isActive?: boolean;
      name?: string;
      passwordHash?: string;
      role?: "ADMIN" | "USER";
    } = {};

    if (typeof body.isActive === "boolean") {
      if (userId === admin.id && body.isActive === false) {
        return NextResponse.json(
          { error: "Eigenes Konto kann nicht deaktiviert werden." },
          { status: 400 }
        );
      }
      data.isActive = body.isActive;
    }
    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (typeof body.password === "string" && body.password.length >= 8) {
      data.passwordHash = hashPassword(body.password);
    }
    if (body.role === "ADMIN" || body.role === "USER") {
      if (userId === admin.id && body.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Eigene Admin-Rolle kann nicht entfernt werden." },
          { status: 400 }
        );
      }
      data.role = body.role;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        color: true,
      },
    });

    if (data.passwordHash || data.isActive === false) {
      await prisma.session.deleteMany({ where: { userId } });
    }

    return NextResponse.json({ user });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
