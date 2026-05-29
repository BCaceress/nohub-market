/**
 * POST /api/outbox/process
 *
 * Vercel Cron endpoint — processa lote de OutboxEvents pendentes.
 * Configurado em vercel.json: { "crons": [{ "path": "/api/outbox/process", "schedule": "* * * * *" }] }
 *
 * Protegido por CRON_SECRET para evitar chamadas externas.
 */

import { type NextRequest, NextResponse } from "next/server";
import { processOutboxBatch } from "@/features/sales/outbox/processor";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Pro: até 60s para Cron

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verifica se é chamada legítima do Vercel Cron ou chamada interna autenticada
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processOutboxBatch();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[OutboxCron] Erro ao processar batch:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Vercel Cron invoca via GET também em alguns planos
export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
