import { prisma } from "@nohub/db";
import { History } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Auditoria — NoHub Market" };

const ACTION_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline" | "soft" | "info" | "warning" | "success"
> = {
  "organization.created": "soft",
  "organization.updated": "secondary",
  "member.added": "info",
  "member.removed": "destructive",
  "product.created": "soft",
  "product.updated": "secondary",
  "product.deleted": "destructive",
  "location.created": "soft",
  "location.deleted": "destructive",
  "channel.enabled": "success",
  "channel.disabled": "outline",
  "supplier.created": "soft",
  "supplier.deleted": "destructive",
  "onboarding.completed": "success",
  "account.exportRequested": "warning",
  "account.deletionRequested": "destructive",
};

const ACTION_LABEL: Record<string, string> = {
  "organization.created": "Organização criada",
  "organization.updated": "Organização atualizada",
  "member.added": "Membro adicionado",
  "member.removed": "Membro removido",
  "member.invited": "Convite enviado",
  "invitation.accepted": "Convite aceito",
  "product.created": "Produto criado",
  "product.updated": "Produto atualizado",
  "product.deleted": "Produto removido",
  "location.created": "Unidade criada",
  "location.updated": "Unidade atualizada",
  "location.deleted": "Unidade removida",
  "channel.enabled": "Canal ativado",
  "channel.disabled": "Canal desativado",
  "channel.configured": "Canal configurado",
  "supplier.created": "Fornecedor criado",
  "supplier.updated": "Fornecedor atualizado",
  "supplier.deleted": "Fornecedor removido",
  "capabilities.materialized": "Capabilities derivadas",
  "onboarding.completed": "Onboarding concluído",
  "account.exportRequested": "Exportação de dados solicitada",
  "account.deletionRequested": "Exclusão de conta solicitada",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  if (!["owner", "admin"].includes(member.role)) {
    redirect("/app");
  }

  const page = Math.max(1, Number(sp.page ?? 1));
  const perPage = 50;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        organizationId: member.organizationId,
        ...(sp.type ? { resourceType: sp.type } : {}),
      },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: perPage,
      skip: (page - 1) * perPage,
    }),
    prisma.auditLog.count({
      where: {
        organizationId: member.organizationId,
        ...(sp.type ? { resourceType: sp.type } : {}),
      },
    }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  const resourceTypes = await prisma.auditLog.findMany({
    where: { organizationId: member.organizationId },
    select: { resourceType: true },
    distinct: ["resourceType"],
    orderBy: { resourceType: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<History className="h-5 w-5" />}
        iconTone="primary"
        title="Auditoria"
        description={`${total} evento${total !== 1 ? "s" : ""} registrado${total !== 1 ? "s" : ""} na organização.`}
      />

      {/* Filter form */}
      <form className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Select name="type" defaultValue={sp.type ?? ""}>
            <option value="">Todos os recursos</option>
            {resourceTypes.map((r) => (
              <option key={r.resourceType} value={r.resourceType}>
                {r.resourceType}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Data/hora</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Recurso</TableHead>
            <TableHead>Ator</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.length === 0 ? (
            <TableEmpty
              icon={<History className="h-5 w-5" />}
              title="Nenhum evento encontrado"
              description="Ações na organização aparecem aqui em ordem cronológica."
            />
          ) : (
            logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-mono text-[11.5px] text-muted-foreground tabular-nums whitespace-nowrap">
                  {log.createdAt.toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={ACTION_VARIANT[log.action] ?? "outline"}
                    className="whitespace-nowrap"
                  >
                    {ACTION_LABEL[log.action] ?? log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-[12.5px] text-muted-foreground">
                  {log.resourceType}
                  {log.resourceId && (
                    <span className="ml-1.5 font-mono text-[11px] opacity-60">
                      {log.resourceId.slice(-6)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-[12.5px]">
                  {log.actor ? (
                    <span className="font-medium">{log.actor.name}</span>
                  ) : (
                    <span className="text-muted-foreground italic">Sistema</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-[12.5px]">
          <span className="text-muted-foreground">
            Página <span className="font-semibold text-foreground tabular-nums">{page}</span> de{" "}
            <span className="font-semibold text-foreground tabular-nums">{totalPages}</span>
          </span>
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <a href={`?page=${page - 1}${sp.type ? `&type=${sp.type}` : ""}`}>Anterior</a>
            </Button>
          )}
          {page < totalPages && (
            <Button variant="outline" size="sm" asChild>
              <a href={`?page=${page + 1}${sp.type ? `&type=${sp.type}` : ""}`}>Próxima</a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
