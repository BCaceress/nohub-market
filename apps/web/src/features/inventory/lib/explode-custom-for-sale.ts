/**
 * explodeCustomForSale — baixa de estoque de um produto CUSTOM (personalizado).
 * Combina componentes fixos (ProductKitComponent) + opções escolhidas na venda
 * (OrderItemSelection). O produto CUSTOM não tem saldo próprio (igual KIT).
 */

import { prisma } from "@nohub/db";
import { applyMovement } from "./apply-movement";
import { getAvailable } from "./get-available";

export type CustomComponent = {
  componentProductId: string;
  componentVariantId: string | null;
  quantity: number; // por unidade do produto CUSTOM
  label: string;
};

export type CustomSaleInput = {
  organizationId: string;
  locationId: string;
  customProductId: string;
  saleQuantity: number;
  // Escolhas congeladas do item (OrderItemSelection)
  selections: Array<{
    componentProductId: string;
    componentVariantId: string | null;
    quantitySnapshot: number;
    optionNameSnapshot: string;
  }>;
  actorId: string;
  actorName?: string | null;
  referenceType?: string;
  referenceId?: string;
};

export type CustomSaleResult =
  | { success: true; movementIds: string[]; componentsConsumed: number }
  | { success: false; error: string; insufficientComponent?: string };

export async function explodeCustomForSale(input: CustomSaleInput): Promise<CustomSaleResult> {
  // Componentes fixos do produto CUSTOM (reaproveita ProductKitComponent)
  const fixed = await prisma.productKitComponent.findMany({
    where: { kitProductId: input.customProductId },
    include: { componentProduct: { select: { name: true } } },
    orderBy: { position: "asc" },
  });

  const components: CustomComponent[] = [
    ...fixed.map((c) => ({
      componentProductId: c.componentProductId,
      componentVariantId: c.componentVariantId,
      quantity: Number(c.quantity),
      label: c.componentProduct.name,
    })),
    ...input.selections.map((s) => ({
      componentProductId: s.componentProductId,
      componentVariantId: s.componentVariantId,
      quantity: Number(s.quantitySnapshot),
      label: s.optionNameSnapshot,
    })),
  ];

  if (components.length === 0) {
    return { success: true, movementIds: [], componentsConsumed: 0 };
  }

  // Verificar disponível para cada componente antes de mover
  for (const comp of components) {
    const needed = comp.quantity * input.saleQuantity;
    const avail = await getAvailable({
      organizationId: input.organizationId,
      productId: comp.componentProductId,
      variantId: comp.componentVariantId,
      locationId: input.locationId,
    });

    if (avail.available < needed) {
      return {
        success: false,
        error: `Estoque insuficiente para "${comp.label}" (disponível: ${avail.available.toFixed(3)}, necessário: ${needed.toFixed(3)})`,
        insufficientComponent: comp.componentProductId,
      };
    }
  }

  // Aplicar movimentos de OUTBOUND para cada componente
  const movementIds: string[] = [];

  for (const comp of components) {
    const qty = comp.quantity * input.saleQuantity;
    const result = await applyMovement({
      organizationId: input.organizationId,
      locationId: input.locationId,
      productId: comp.componentProductId,
      variantId: comp.componentVariantId,
      type: "OUTBOUND",
      quantity: qty,
      reason: "SALE",
      referenceType: input.referenceType ?? "CUSTOM_SALE",
      referenceId: input.referenceId ?? input.customProductId,
      note: `Componente de personalizado — baixa por venda de ${input.saleQuantity}x`,
      actorId: input.actorId,
      actorName: input.actorName,
    });

    if (!result.success) {
      // Rollback: reverter os movimentos já feitos
      for (const mid of movementIds) {
        const mv = await prisma.stockMovement.findUnique({ where: { id: mid } });
        if (mv) {
          await applyMovement({
            organizationId: input.organizationId,
            locationId: mv.locationId,
            productId: mv.productId,
            variantId: mv.variantId,
            type: "INBOUND",
            quantity: Number(mv.quantity),
            reason: "MANUAL",
            note: `Estorno de personalizado: ${result.message}`,
            actorId: input.actorId,
          }).catch(() => {});
        }
      }
      return { success: false, error: result.message };
    }

    movementIds.push(result.movementId);
  }

  return {
    success: true,
    movementIds,
    componentsConsumed: components.length,
  };
}
