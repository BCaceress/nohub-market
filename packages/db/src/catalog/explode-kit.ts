import { prisma } from "../index";

export interface KitComponent {
  componentProductId: string;
  componentVariantId: string | null;
  quantity: number;
  position: number;
  product: { id: string; name: string; unit: string; productType: string };
  variant: { id: string; name: string; sku: string | null } | null;
}

export type ExplodeKitResult =
  | { success: true; data: KitComponent[] }
  | { success: false; error: "NOT_A_KIT" | "EMPTY_KIT" | "NESTED_KIT" };

/**
 * Explode um KIT em seus componentes com quantidades.
 * Verifica RN-C03 (kit não tem estoque próprio) e RN-C04 (sem kit-de-kit).
 */
export async function explodeKit(kitProductId: string): Promise<ExplodeKitResult> {
  const kit = await prisma.product.findUnique({
    where: { id: kitProductId },
    select: { productType: true },
  });

  if (!kit || kit.productType !== "KIT") {
    return { success: false, error: "NOT_A_KIT" };
  }

  const components = await prisma.productKitComponent.findMany({
    where: { kitProductId },
    include: {
      componentProduct: {
        select: { id: true, name: true, unit: true, productType: true },
      },
      componentVariant: {
        select: { id: true, name: true, sku: true },
      },
    },
    orderBy: { position: "asc" },
  });

  if (components.length === 0) {
    return { success: false, error: "EMPTY_KIT" };
  }

  // RN-C04: nenhum componente pode ser KIT
  const hasNestedKit = components.some(
    (c) => c.componentProduct.productType === "KIT",
  );
  if (hasNestedKit) {
    return { success: false, error: "NESTED_KIT" };
  }

  return {
    success: true,
    data: components.map((c) => ({
      componentProductId: c.componentProductId,
      componentVariantId: c.componentVariantId,
      quantity: Number(c.quantity),
      position: c.position,
      product: c.componentProduct,
      variant: c.componentVariant,
    })),
  };
}
