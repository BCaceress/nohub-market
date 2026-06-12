import { prisma } from "@nohub/db";
import { Truck } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SupplierForm } from "@/features/app/components/supplier-form";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Novo Fornecedor — NoHub Market" };

export default async function NewSupplierPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        backHref="/app/suppliers"
        backLabel="Fornecedores"
        icon={<Truck className="h-5 w-5" />}
        iconTone="primary"
        title="Novo Fornecedor"
        description="Preencha os dados do fornecedor. Use o botão Buscar para preencher automaticamente via CNPJ."
      />
      <SupplierForm organizationId={member.organizationId} />
    </div>
  );
}
