import { prisma } from "@nohub/db";
import { Plus, Truck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getSuppliersAction } from "@/features/app/actions/supplier-actions";
import { getSession } from "@/lib/auth-server";
import { SupplierListClient } from "./supplier-list-client";

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
        description={`${suppliers.length} fornecedor${suppliers.length !== 1 ? "es" : ""} cadastrado${suppliers.length !== 1 ? "s" : ""}.`}
        actions={
          <Button asChild size="sm">
            <Link href="/app/suppliers/new">
              <Plus className="mr-2 h-4 w-4" />
              Novo fornecedor
            </Link>
          </Button>
        }
      />

      {suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-16 text-center">
          <Truck className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="font-semibold text-foreground">Nenhum fornecedor cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Cadastre seus fornecedores para gerenciar compras, preços e relacionamento comercial.
          </p>
          <Button asChild size="sm">
            <Link href="/app/suppliers/new">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar fornecedor
            </Link>
          </Button>
        </div>
      ) : (
        <SupplierListClient organizationId={member.organizationId} suppliers={suppliers} />
      )}
    </div>
  );
}
