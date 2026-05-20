/**
 * explodeKitForSale — gera os movimentos de saída dos componentes de um kit.
 * Kit NÃO tem saldo próprio (RN-E04 / RN-C03).
 * "Estoque do kit" = mínimo montável dado o estoque dos componentes.
 */

import { prisma } from "@nohub/db";
import { explodeKit } from "@nohub/db/catalog";
import { getAvailable } from "./get-available";
import { applyMovement } from "./apply-movement";

export type KitSaleInput = {
  organizationId: string;
  locationId:     string;
  kitProductId:   string;
  saleQuantity:   number; // quantas unidades do kit vendeu
  actorId:        string;
  actorName?:     string | null;
  referenceType?: string;
  referenceId?:   string;
};

export type KitSaleResult =
  | { success: true;  movementIds: string[]; componentsConsumed: number }
  | { success: false; error: string; insufficientComponent?: string };

export async function explodeKitForSale(input: KitSaleInput): Promise<KitSaleResult> {
  // Usa a função da Etapa 2 para resolver os componentes
  const kitResult = await explodeKit(input.kitProductId);
  if (!kitResult.success) {
    return { success: false, error: kitResult.error };
  }

  const components = kitResult.data;

  // Verificar disponível para cada componente antes de mover
  for (const comp of components) {
    const needed = comp.quantity * input.saleQuantity;
    const avail = await getAvailable({
      organizationId: input.organizationId,
      productId:      comp.componentProductId,
      variantId:      comp.componentVariantId,
      locationId:     input.locationId,
    });

    if (avail.available < needed) {
      const product = await prisma.product.findUnique({
        where: { id: comp.componentProductId },
        select: { name: true },
      });
      return {
        success: false,
        error: `Estoque insuficiente para componente "${product?.name ?? comp.componentProductId}" (disponível: ${avail.available.toFixed(3)}, necessário: ${needed.toFixed(3)})`,
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
      locationId:     input.locationId,
      productId:      comp.componentProductId,
      variantId:      comp.componentVariantId,
      type:           "OUTBOUND",
      quantity:       qty,
      reason:         "SALE",
      referenceType:  input.referenceType ?? "KIT_SALE",
      referenceId:    input.referenceId ?? input.kitProductId,
      note:           `Componente de kit — baixa por venda de ${input.saleQuantity}x kit`,
      actorId:        input.actorId,
      actorName:      input.actorName,
    });

    if (!result.success) {
      // Rollback: reverter os movimentos já feitos
      for (const mid of movementIds) {
        const mv = await prisma.stockMovement.findUnique({ where: { id: mid } });
        if (mv) {
          await applyMovement({
            organizationId: input.organizationId,
            locationId:     mv.locationId,
            productId:      mv.productId,
            variantId:      mv.variantId,
            type:           "INBOUND",
            quantity:       Number(mv.quantity),
            reason:         "MANUAL",
            note:           `Estorno de kit: ${result.message}`,
            actorId:        input.actorId,
          }).catch(() => {});
        }
      }
      return { success: false, error: result.message };
    }

    movementIds.push(result.movementId);
  }

  return {
    success:            true,
    movementIds,
    componentsConsumed: components.length,
  };
}

/**
 * Calcula quantas unidades do kit é possível montar
 * dado o estoque atual dos componentes.
 */
export async function getKitAvailableUnits(input: {
  organizationId: string;
  locationId:     string;
  kitProductId:   string;
}): Promise<number> {
  const kitResult = await explodeKit(input.kitProductId);
  if (!kitResult.success) return 0;

  let minMountable = Infinity;

  for (const comp of kitResult.data) {
    const avail = await getAvailable({
      organizationId: input.organizationId,
      productId:      comp.componentProductId,
      variantId:      comp.componentVariantId,
      locationId:     input.locationId,
    });

    const mountableFromThisComp = comp.quantity > 0 ? avail.available / comp.quantity : Infinity;
    minMountable = Math.min(minMountable, mountableFromThisComp);
  }

  return minMountable === Infinity ? 0 : Math.floor(minMountable);
}
