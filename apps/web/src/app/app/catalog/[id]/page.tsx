import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductForm } from "@/features/app/product-form";
import { getProductAction } from "@/features/app/actions/product-actions";
import { getSuppliersAction } from "@/features/app/actions/supplier-actions";
import { getSession } from "@/lib/auth-server";
import { getCapabilities } from "@/lib/capabilities";
import { prisma } from "@nohub/db";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Editar produto — NoHub Market" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const [product, suppliers, caps] = await Promise.all([
    getProductAction(id, member.organizationId),
    getSuppliersAction(member.organizationId),
    getCapabilities(member.organizationId),
  ]);
  if (!product) notFound();

  const capabilities = Array.from(caps.keys()).map((key) => ({ key }));

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Editar produto</h1>
        <p className="text-muted-foreground text-sm mt-1">{product.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do produto</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm
            organizationId={member.organizationId}
            product={product}
            suppliers={suppliers}
            capabilities={capabilities}
          />
        </CardContent>
      </Card>
    </div>
  );
}
