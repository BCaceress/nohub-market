import fs from "node:fs";
import path from "node:path";
import { prisma } from "@nohub/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function safeList(p: string): { exists: boolean; entries: string[] } {
  try {
    const entries = fs.readdirSync(p).slice(0, 30);
    return { exists: true, entries };
  } catch {
    return { exists: false, entries: [] };
  }
}

export async function GET(): Promise<NextResponse> {
  const taskRoot = "/var/task";
  const pnpmRoot = path.join(taskRoot, "node_modules/.pnpm");
  const pnpmInfo = safeList(pnpmRoot);

  const prismaEntries = pnpmInfo.entries.filter((d) => d.startsWith("@prisma"));

  const enginePaths = prismaEntries.map((entry) => {
    const p = path.join(pnpmRoot, entry, "node_modules/.prisma/client");
    const info = safeList(p);
    return { path: p, ...info };
  });

  const nextServerDir = path.join(taskRoot, "apps/web/.next/server");
  const nextServerInfo = safeList(nextServerDir);
  const dotPrismaDir = path.join(taskRoot, "apps/web/.prisma/client");

  const fsInfo = {
    taskRootEntries: safeList(taskRoot).entries,
    nodeModulesEntries: safeList(path.join(taskRoot, "node_modules")).entries.slice(0, 10),
    pnpmExists: pnpmInfo.exists,
    pnpmTotalEntries: pnpmInfo.entries.length,
    prismaEntries,
    enginePaths,
    nextServerNodeFiles: nextServerInfo.entries.filter((f) => f.endsWith(".node")),
    dotPrismaExists: safeList(dotPrismaDir).exists,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, fsInfo });
  } catch (err) {
    return NextResponse.json(
      {
        error: String(err).slice(0, 800),
        fsInfo,
      },
      { status: 500 },
    );
  }
}
