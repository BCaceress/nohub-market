import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getProductsAction } from "@/features/app/actions/product-actions";
import { getSession } from "@/lib/auth-server";
import { prisma } from "@nohub/db";
import { Package, Pencil, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Catálogo — NoHub Market" };

const UNIT_LABELS: Record<string, string> = {
  UN: "un",
  KG: "kg",
  G: "g",
  L: "l",
  ML: "ml",
  CX: "cx",
  PCT: "pct",
};

function formatPrice(v: { toString(): string }) {
  return Number(v.toString()).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/signin");

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!member) redirect("/onboarding");

  const products = await getProductsAction(member.organizationId, {
    search: sp.q,
  });

  const hasFilter = Boolean(sp.q);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length === 0
              ? "Nenhum produto encontrado"
              : `${products.length} produto${products.length !== 1 ? "s" : ""}${sp.q ? ` para "${sp.q}"` : ""}`}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/catalog/new">
            <Plus className="h-4 w-4" />
            Novo produto
          </Link>
        </Button>
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      <form className="flex flex-wrap items-center gap-2">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="Buscar nome, SKU ou código…"
            className="h-9 w-64 rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 shadow-xs transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
          />
        </div>

        <Button type="submit" variant="secondary" size="sm" className="h-9 gap-1.5">
          <Search className="h-3.5 w-3.5" />
          Filtrar
        </Button>

        {hasFilter && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5" asChild>
            <Link href="/app/catalog">
              <X className="h-3.5 w-3.5" />
              Limpar
            </Link>
          </Button>
        )}
      </form>

      {/* ── Empty state ──────────────────────────────────────── */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-base font-semibold">
            {sp.q ? "Nenhum resultado" : "Catálogo vazio"}
          </h3>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            {sp.q
              ? `Não encontramos produtos para "${sp.q}". Tente outro termo.`
              : "Adicione o primeiro produto do catálogo para começar."}
          </p>
          {!sp.q && (
            <Button asChild className="mt-6">
              <Link href="/app/catalog/new">
                <Plus className="h-4 w-4" />
                Criar produto
              </Link>
            </Button>
          )}
        </div>
      ) : (
        /* ── Product grid ────────────────────────────────────── */
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {products.map((p) => (
            <Card
              key={p.id}
              className={[
                "group relative overflow-hidden transition-all duration-150 hover:shadow-md hover:-translate-y-0.5",
                !p.active ? "opacity-60" : "",
              ].join(" ")}
            >
              {/* Edit button */}
              <Link
                href={`/app/catalog/${p.id}`}
                className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-secondary"
                aria-label={`Editar ${p.name}`}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>

              <CardHeader className="pb-2 pr-10">
                <p className="text-sm font-semibold leading-snug line-clamp-2">{p.name}</p>
              </CardHeader>

              <CardContent className="flex flex-col gap-3">
                {/* Price */}
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tracking-tight">{formatPrice(p.price)}</span>
                  <span className="text-xs text-muted-foreground">
                    / {UNIT_LABELS[p.unit] ?? p.unit}
                  </span>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  {p.supplier && <Badge variant="outline">{p.supplier.name}</Badge>}
                  {!p.active && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inativo
                    </Badge>
                  )}
                  {p.hasAgeRestriction && <Badge variant="warning">+{p.minAge}</Badge>}
                </div>

                {/* SKU */}
                {p.sku && (
                  <p className="font-mono text-[10px] text-muted-foreground/70 tracking-wide">
                    {p.sku}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
