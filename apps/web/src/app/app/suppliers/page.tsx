import { prisma } from "@nohub/db";
import { Truck } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSuppliersAction } from "@/features/app/actions/supplier-actions";
import { SuppliersManager } from "@/features/app/suppliers-manager";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Fornecedores — NoHub Market" };

export default async function SuppliersPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const suppliers = await getSuppliersAction(member.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Truck className="h-5 w-5" />}
        iconTone="primary"
        title="Fornecedores"
        description={`${suppliers.length} fornecedor${suppliers.length !== 1 ? "es" : ""} vinculado${suppliers.length !== 1 ? "s" : ""} à organização.`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Cadastro de fornecedores</CardTitle>
          <CardDescription>
            Fornecedores serão vinculados ao catálogo em etapa futura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SuppliersManager organizationId={member.organizationId} initialSuppliers={suppliers} />
        </CardContent>
      </Card>
    </div>
  );
}
