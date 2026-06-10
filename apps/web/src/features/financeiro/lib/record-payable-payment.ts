import "server-only";
import { prisma } from "@nohub/db";
import { writeAudit } from "@/lib/audit";

export type RecordPayablePaymentInput = {
  organizationId: string;
  payableId: string;
  amount: number;
  paymentDate?: string; // ISO; default agora
  actorId: string;
};

export type RecordPayablePaymentResult =
  | { success: true; status: string; paidAmount: number }
  | { success: false; error: string };

/** Baixa (parcial/total) de conta a pagar. Transiciona status e audita. */
export async function recordPayablePayment(
  input: RecordPayablePaymentInput,
): Promise<RecordPayablePaymentResult> {
  const payable = await prisma.accountPayable.findUnique({ where: { id: input.payableId } });
  if (!payable || payable.organizationId !== input.organizationId) {
    return { success: false, error: "Conta não encontrada" };
  }
  if (payable.status === "CANCELED") {
    return { success: false, error: "Conta cancelada — não aceita baixa" };
  }
  if (payable.status === "PAID") {
    return { success: false, error: "Conta já quitada" };
  }
  if (input.amount <= 0) {
    return { success: false, error: "Valor inválido" };
  }

  const amount = Number(payable.amount);
  const newPaid = Math.min(amount, Number(payable.paidAmount) + input.amount);
  const fullyPaid = newPaid >= amount - 0.001;
  const status = fullyPaid ? "PAID" : "PARTIALLY_PAID";
  const paidAt = fullyPaid ? new Date(input.paymentDate ?? Date.now()) : payable.paidAt;

  await prisma.accountPayable.update({
    where: { id: payable.id },
    data: { paidAmount: newPaid, status, paidAt },
  });

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "payable.payment_recorded",
    resourceType: "AccountPayable",
    resourceId: payable.id,
    before: { paidAmount: Number(payable.paidAmount), status: payable.status },
    after: { paidAmount: newPaid, status },
  });

  return { success: true, status, paidAmount: newPaid };
}
