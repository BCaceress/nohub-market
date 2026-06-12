import "server-only";
import { prisma } from "@nohub/db";
import { writeAudit } from "@/lib/audit";

export type RecordReceivableReceiptInput = {
  organizationId: string;
  receivableId: string;
  amount: number;
  receiptDate?: string; // ISO; default agora
  actorId: string;
};

export type RecordReceivableReceiptResult =
  | { success: true; status: string; receivedAmount: number }
  | { success: false; error: string };

/** Baixa (parcial/total) de conta a receber. Transiciona status e audita. */
export async function recordReceivableReceipt(
  input: RecordReceivableReceiptInput,
): Promise<RecordReceivableReceiptResult> {
  const rec = await prisma.accountReceivable.findUnique({ where: { id: input.receivableId } });
  if (!rec || rec.organizationId !== input.organizationId) {
    return { success: false, error: "Conta não encontrada" };
  }
  if (rec.status === "CANCELED") {
    return { success: false, error: "Conta cancelada — não aceita baixa" };
  }
  if (rec.status === "RECEIVED") {
    return { success: false, error: "Conta já recebida" };
  }
  if (input.amount <= 0) {
    return { success: false, error: "Valor inválido" };
  }

  const amount = Number(rec.amount);
  const newReceived = Math.min(amount, Number(rec.receivedAmount) + input.amount);
  const fullyReceived = newReceived >= amount - 0.001;
  const status = fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
  const receivedAt = fullyReceived ? new Date(input.receiptDate ?? Date.now()) : rec.receivedAt;

  await prisma.accountReceivable.update({
    where: { id: rec.id },
    data: { receivedAmount: newReceived, status, receivedAt },
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "receivable.receipt_recorded",
    resourceType: "AccountReceivable",
    resourceId: rec.id,
    before: { receivedAmount: Number(rec.receivedAmount), status: rec.status },
    after: { receivedAmount: newReceived, status },
  });

  return { success: true, status, receivedAmount: newReceived };
}
