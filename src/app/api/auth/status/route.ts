import { NextRequest, NextResponse } from "next/server";
import { needsSetup } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ needsSetup: await needsSetup() });
}
