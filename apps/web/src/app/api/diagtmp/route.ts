import { prisma } from "@nohub/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// TEMP diagnostic endpoint — remove after debugging the auth 500.
export async function GET() {
  const url = process.env.DATABASE_URL ?? "";
  let host = "(unset)";
  try {
    host = url ? new URL(url).host : "(empty)";
  } catch {
    host = "(unparseable)";
  }

  const result: Record<string, unknown> = {
    databaseUrlSet: Boolean(url),
    databaseHost: host,
    betterAuthUrlSet: Boolean(process.env.BETTER_AUTH_URL),
    nodeVersion: process.version,
  };

  try {
    const one = await prisma.$queryRaw`select 1 as ok`;
    result.queryRaw = one;
  } catch (e) {
    result.queryRawError = {
      name: (e as Error)?.name,
      message: (e as Error)?.message,
      stack: (e as Error)?.stack?.split("\n").slice(0, 6),
    };
  }

  try {
    result.userCount = await prisma.user.count();
  } catch (e) {
    result.userCountError = {
      name: (e as Error)?.name,
      message: (e as Error)?.message,
    };
  }

  return NextResponse.json(result);
}
