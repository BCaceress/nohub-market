import { Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  getCustomerAction,
  getCustomerAuditLogAction,
  getCustomerOrderHistoryAction,
  getCustomerStatsAction,
} from "@/features/app/actions/customer-actions";
import { CustomerDetailClient } from "@/features/app/components/customer-detail-client";
import { CustomerEditSheet } from "@/features/app/components/customer-edit-sheet";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Cliente — NoHub Market" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/signin");

  const customerRes = await getCustomerAction(id);
  if (!customerRes.success) notFound();
  const customer = customerRes.data;

  const [stats, orderHistory, auditLogs] = await Promise.all([
    getCustomerStatsAction(id),
    getCustomerOrderHistoryAction(id),
    getCustomerAuditLogAction(id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        backHref="/app/customers"
        backLabel="Clientes"
        icon={<Users className="h-5 w-5" />}
        iconTone="primary"
        title={customer.name ?? "Cliente sem nome"}
        meta={<Badge variant="outline">{customer.personType === "PJ" ? "PJ" : "PF"}</Badge>}
        actions={<CustomerEditSheet organizationId={customer.organizationId} customer={customer} />}
      />

      <CustomerDetailClient
        customer={customer as never}
        stats={stats as never}
        orderHistory={orderHistory as never}
        auditLogs={auditLogs as never}
      />
    </div>
  );
}
