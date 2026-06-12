import { Truck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  getSupplierAccountsPayableAction,
  getSupplierAuditLogAction,
  getSupplierDetailAction,
  getSupplierPriceEvolutionAction,
  getSupplierPurchaseHistoryAction,
  getSupplierStatsAction,
} from "@/features/app/actions/supplier-actions";
import { SupplierDetailClient } from "@/features/app/components/supplier-detail-client";
import { SupplierEditSheet } from "@/features/app/components/supplier-edit-sheet";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Fornecedor — NoHub Market" };

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/signin");

  const [supplier, stats, purchaseHistory, priceEvolution, accountsPayable, auditData] =
    await Promise.all([
      getSupplierDetailAction(id),
      getSupplierStatsAction(id),
      getSupplierPurchaseHistoryAction(id),
      getSupplierPriceEvolutionAction(id),
      getSupplierAccountsPayableAction(id),
      getSupplierAuditLogAction(id),
    ]);

  if (!supplier) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        backHref="/app/suppliers"
        backLabel="Fornecedores"
        icon={<Truck className="h-5 w-5" />}
        iconTone="primary"
        title={supplier.tradeName ?? supplier.name}
        description={supplier.tradeName ? supplier.name : undefined}
        meta={supplier.segment ? <Badge variant="outline">{supplier.segment}</Badge> : undefined}
        actions={<SupplierEditSheet organizationId={supplier.organizationId} supplier={supplier} />}
      />

      <SupplierDetailClient
        supplier={supplier as never}
        stats={stats as never}
        purchaseHistory={purchaseHistory as never}
        priceEvolution={priceEvolution as never}
        accountsPayable={accountsPayable as never}
        auditData={auditData as never}
        organizationId={supplier.organizationId}
      />
    </div>
  );
}
