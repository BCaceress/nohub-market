import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function safeList(p: string): { exists: boolean; entries: string[] } {
  try {
    return { exists: true, entries: fs.readdirSync(p) };
  } catch {
    return { exists: false, entries: [] };
  }
}

export async function GET(): Promise<NextResponse> {
  const taskRoot = "/var/task";
  const pnpmRoot = path.join(taskRoot, "node_modules/.pnpm");

  const pnpmInfo = safeList(pnpmRoot);
  const nmRoot = safeList(path.join(taskRoot, "node_modules"));

  // check all possible @prisma paths
  const prismaDirectPaths = [
    path.join(taskRoot, "node_modules/@prisma"),
    path.join(
      taskRoot,
      "node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@5.9.3__typescript@5.9.3/node_modules/.prisma/client",
    ),
  ];

  const fsInfo = {
    taskRootEntries: safeList(taskRoot).entries,
    nodeModulesExists: nmRoot.exists,
    nodeModulesEntries: nmRoot.entries,
    pnpmExists: pnpmInfo.exists,
    pnpmAllEntries: pnpmInfo.entries,
    prismaDirectPaths: prismaDirectPaths.map((p) => ({ path: p, ...safeList(p) })),
  };

  return NextResponse.json(fsInfo);
}
