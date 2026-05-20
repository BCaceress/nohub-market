import Link from "next/link";
import { MapPin, Package, Radio, Zap, ArrowRight, Plus, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";

export const metadata = { title: "Dashboard — NoHub Market" };

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Gerente",
  operator: "Operador",
  viewer: "Visualizador",
};

const CAP_LABELS: Record<string, string> = {
  "product.age_restriction":  "Restrição de idade",
  "product.time_restriction": "Restrição de horário",
  "product.expiry_tracking":  "Controle de validade",
  "product.fractioned_sale":  "Venda fracionada",
  "operation.unmanned":       "Operação autônoma",
  "operation.24h":            "Funcionamento 24h",
  "operation.pos":            "PDV",
};

const METRIC_CONFIG = [
  {
    key: "locations",
    label: "Unidades",
    icon: MapPin,
    href: "/app/locations",
    linkLabel: "Ver unidades",
    iconClass: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  },
  {
    key: "channels",
    label: "Canais ativos",
    icon: Radio,
    href: "/app/channels",
    linkLabel: "Gerenciar canais",
    iconClass: "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400",
  },
  {
    key: "suppliers",
    label: "Fornecedores",
    icon: Package,
    href: "/app/suppliers",
    linkLabel: "Ver fornecedores",
    iconClass: "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400",
  },
  {
    key: "capabilities",
    label: "Capabilities",
    icon: Zap,
    href: null,
    linkLabel: null,
    iconClass: "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400",
  },
] as const;

const SHORTCUTS = [
  { href: "/app/locations/new",  label: "Adicionar unidade",        icon: MapPin,    desc: "Nova filial ou ponto de venda" },
  { href: "/app/suppliers",      label: "Cadastrar fornecedor",     icon: Package,   desc: "Gerencie seus fornecedores"   },
  { href: "/app/settings",       label: "Configurar organização",   icon: Settings,  desc: "Dados e preferências da org"  },
];

export default async function DashboardPage() {
  const session = await getSession();
  const member = await prisma.member.findFirst({
    where: { userId: session?.user.id },
    include: {
      organization: {
        include: {
          capabilities:  { where: { enabled: true } },
          locations:     { where: { deletedAt: null } },
          salesChannels: true,
          suppliers:     { where: { deletedAt: null } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const org = member?.organization;
  const enabledChannels = org?.salesChannels.filter((c) => c.enabled).length ?? 0;
  const orgName = org?.tradeName ?? org?.legalName ?? "Dashboard";

  const METRICS = {
    locations:    org?.locations.length ?? 0,
    channels:     enabledChannels,
    suppliers:    org?.suppliers.length ?? 0,
    capabilities: org?.capabilities.length ?? 0,
  };

  return (
    <div className="flex flex-col gap-8">
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{orgName}</h1>
          <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Visão geral da organização</span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              Papel:{" "}
              <Badge variant="secondary" className="font-medium">
                {ROLE_LABELS[member?.role ?? ""] ?? member?.role}
              </Badge>
            </span>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href="/app/catalog/new">
            <Plus className="h-3.5 w-3.5" />
            Novo produto
          </Link>
        </Button>
      </div>

      {/* ── Metric cards ────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRIC_CONFIG.map((m) => (
          <Card key={m.key} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold uppercase tracking-wide">
                  {m.label}
                </CardDescription>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${m.iconClass}`}>
                  <m.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {METRICS[m.key as keyof typeof METRICS]}
              </p>
            </CardHeader>
            <CardContent>
              {m.href ? (
                <Link
                  href={m.href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {m.linkLabel}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground">Módulos ativos</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Capabilities ────────────────────────────────────── */}
      {(org?.capabilities.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Capabilities do negócio</CardTitle>
            <CardDescription>
              Módulos derivados do tipo de operação configurado no onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {org?.capabilities.map((c) => (
                <Badge key={c.id} variant="secondary" className="gap-1.5">
                  <Zap className="h-3 w-3" />
                  {CAP_LABELS[c.key] ?? c.key}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Quick shortcuts ──────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Atalhos
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {SHORTCUTS.map(({ href, label, icon: Icon, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-150 hover:border-border/80 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-none">{label}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{desc}</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
