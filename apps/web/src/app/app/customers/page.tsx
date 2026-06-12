import { prisma } from "@nohub/db";
import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getCustomersAction } from "@/features/app/actions/customer-actions";
import { getSession } from "@/lib/auth-server";
import { CustomerListClient } from "./customer-list-client";

export const metadata = { title: "Clientes — NoHub Market" };

export default async function CustomersPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const customers = await getCustomersAction(member.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Users className="h-5 w-5" />}
        iconTone="primary"
        title="Clientes"
        description={`${customers.length} cliente${customers.length !== 1 ? "s" : ""} cadastrado${customers.length !== 1 ? "s" : ""}.`}
        actions={
          <Button asChild size="sm">
            <Link href="/app/customers/new">
              <Plus className="mr-2 h-4 w-4" />
              Novo cliente
            </Link>
          </Button>
        }
      />

      {customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="font-semibold text-foreground">Nenhum cliente cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Cadastre seus clientes para acompanhar histórico de compras, contato e endereço.
          </p>
          <Button asChild size="sm">
            <Link href="/app/customers/new">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar cliente
            </Link>
          </Button>
        </div>
      ) : (
        <CustomerListClient organizationId={member.organizationId} customers={customers} />
      )}
    </div>
  );
}
