import fs from "node:fs";
import path from "node:path";
import { prisma } from "@nohub/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function safeList(p: string): string[] {
  try {
    return fs.readdirSync(p).slice(0, 20);
  } catch {
    return ["<not found>"];
  }
}

export async function GET(): Promise<NextResponse> {
  const taskRoot = "/var/task";
  const pnpmRoot = path.join(taskRoot, "node_modules/.pnpm");

  const prismaEntries = safeList(pnpmRoot).filter((d) => d.startsWith("@prisma+client"));

  const enginePaths = prismaEntries.map((entry) => {
    const p = path.join(pnpmRoot, entry, "node_modules/.prisma/client");
    return { path: p, exists: fs.existsSync(p), files: safeList(p) };
  });

  const fsInfo = {
    taskRootEntries: safeList(taskRoot),
    pnpmPrismaEntries: prismaEntries,
    enginePaths,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, fsInfo });
  } catch (err) {
    return NextResponse.json(
      {
        error: String(err),
        stack: err instanceof Error ? err.stack?.split("\n").slice(0, 10) : undefined,
        fsInfo,
      },
      { status: 500 },
    );
  }
}
