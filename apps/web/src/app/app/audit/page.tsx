import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";

export const metadata = { title: "Auditoria — NoHub Market" };

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "organization.created": "default",
  "organization.updated": "secondary",
  "member.added": "secondary",
  "member.removed": "destructive",
  "product.created": "default",
  "product.updated": "secondary",
  "product.deleted": "destructive",
  "location.created": "default",
  "location.deleted": "destructive",
  "channel.enabled": "default",
  "channel.disabled": "outline",
  "supplier.created": "default",
  "supplier.deleted": "destructive",
  "onboarding.completed": "default",
  "account.exportRequested": "outline",
  "account.deletionRequested": "destructive",
};

function formatAction(action: string) {
  const map: Record<string, string> = {
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
  return map[action] ?? action;
}

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

  // Apenas owner/admin vê audit completo
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
      <div>
        <h1 className="text-2xl font-bold">Auditoria</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {total} evento(s) registrado(s) na organização.
        </p>
      </div>

      {/* Filtro por tipo */}
      <form className="flex gap-2 flex-wrap">
        <select
          name="type"
          defaultValue={sp.type ?? ""}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos os recursos</option>
          {resourceTypes.map((r) => (
            <option key={r.resourceType} value={r.resourceType}>
              {r.resourceType}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted transition-colors"
        >
          Filtrar
        </button>
      </form>

      {/* Tabela */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Data/hora</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Ação</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Recurso</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Ator</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum evento encontrado.
                  </td>
                </tr>
              ) : (
                logs.map((log, i) => (
                  <tr key={log.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {log.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={ACTION_VARIANT[log.action] ?? "outline"} className="whitespace-nowrap">
                        {formatAction(log.action)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {log.resourceType}
                      {log.resourceId && (
                        <span className="ml-1 font-mono opacity-60">
                          {log.resourceId.slice(-6)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {log.actor ? (
                        <span>{log.actor.name}</span>
                      ) : (
                        <span className="text-muted-foreground">Sistema</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          {page > 1 && (
            <a
              href={`?page=${page - 1}${sp.type ? `&type=${sp.type}` : ""}`}
              className="rounded-md border px-3 py-1.5 hover:bg-muted transition-colors"
            >
              Anterior
            </a>
          )}
          {page < totalPages && (
            <a
              href={`?page=${page + 1}${sp.type ? `&type=${sp.type}` : ""}`}
              className="rounded-md border px-3 py-1.5 hover:bg-muted transition-colors"
            >
              Próxima
            </a>
          )}
        </div>
      )}
    </div>
  );
}
