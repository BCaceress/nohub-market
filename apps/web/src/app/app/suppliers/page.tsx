import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SuppliersManager } from "@/features/app/suppliers-manager";
import { getSuppliersAction } from "@/features/app/actions/supplier-actions";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";

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
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Fornecedores</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie os fornecedores vinculados à sua organização.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadastro de fornecedores</CardTitle>
          <CardDescription>
            Fornecedores serão vinculados ao catálogo em etapa futura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SuppliersManager
            organizationId={member.organizationId}
            initialSuppliers={suppliers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
