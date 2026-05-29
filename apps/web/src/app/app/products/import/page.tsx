import { prisma } from "@nohub/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFiscalTemplatesAction } from "@/features/catalog/actions/tax-actions";
import { ImportWizard } from "@/features/catalog/components/import-wizard";
import { getSession } from "@/lib/auth-server";

export default async function ImportPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const templates = await getFiscalTemplatesAction();

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link
          href="/app/products"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Produtos
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Importar produtos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Três formas de adicionar produtos em massa: template fiscal, planilha CSV ou código de
          barras.
        </p>
      </div>

      <ImportWizard organizationId={member.organizationId} templates={templates} />
    </div>
  );
}
