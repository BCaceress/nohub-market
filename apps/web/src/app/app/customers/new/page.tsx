import { prisma } from "@nohub/db";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { CustomerForm } from "@/features/app/components/customer-form";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Novo Cliente — NoHub Market" };

export default async function NewCustomerPage() {
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
        backHref="/app/customers"
        backLabel="Clientes"
        icon={<Users className="h-5 w-5" />}
        iconTone="primary"
        title="Novo Cliente"
        description="Preencha os dados do cliente. Para PJ, use Buscar para preencher via CNPJ."
      />
      <CustomerForm organizationId={member.organizationId} />
    </div>
  );
}
