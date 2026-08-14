import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authErrorResponse, requireSessionUser } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await requireSessionUser();
    const body = await req.json();
    const name =
      typeof body.name === "string" ? body.name.trim() : undefined;
    const gender =
      body.gender === "FEMALE" ||
      body.gender === "MALE" ||
      body.gender === "UNSPECIFIED"
        ? body.gender
        : undefined;
    const color =
      typeof body.color === "string" && body.color.trim()
        ? body.color.trim()
        : undefined;

    if (name !== undefined && name.length < 1) {
      return NextResponse.json({ error: "Name nötig" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(gender !== undefined ? { gender } : {}),
        ...(color !== undefined ? { color } : {}),
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      username: updated.username,
      color: updated.color,
      gender: updated.gender,
      avatarUrl: updated.avatarUrl,
      role: updated.role,
    });
  } catch (e) {
    const { error, status } = authErrorResponse(e);
    return NextResponse.json({ error }, { status });
  }
}
