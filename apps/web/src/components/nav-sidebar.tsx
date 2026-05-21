"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  DollarSign,
  Download,
  FileText,
  FolderOpen,
  History,
  Link2,
  MapPin,
  Package,
  PackagePlus,
  Radio,
  Receipt,
  RotateCcw,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  SkipForward,
  Sparkles,
  Trash2,
  TrendingUp,
  Truck,
  User,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* ── Data ──────────────────────────────────────────────────── */

type NavItem = { href: string; label: string; icon: React.ElementType };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Geral",
    items: [{ href: "/app", label: "Dashboard", icon: BarChart3 }],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/app/products", label: "Produtos", icon: ShoppingBag },
      { href: "/app/products/categories", label: "Categorias", icon: FolderOpen },
      { href: "/app/products/prices", label: "Preços", icon: DollarSign },
      { href: "/app/products/import", label: "Importar", icon: Download },
    ],
  },
  {
    label: "Estoque",
    items: [
      { href: "/app/inventory", label: "Visão geral", icon: Boxes },
      { href: "/app/inventory/movements", label: "Movimentações", icon: TrendingUp },
      { href: "/app/inventory/inbound", label: "Entrada", icon: PackagePlus },
      { href: "/app/inventory/loss", label: "Perda", icon: Trash2 },
      { href: "/app/inventory/transfer", label: "Transferência", icon: ArrowLeftRight },
      { href: "/app/inventory/count", label: "Contagem", icon: ClipboardList },
    ],
  },
  {
    label: "Vendas",
    items: [
      { href: "/app/sales/pos", label: "PDV", icon: ShoppingCart },
      { href: "/app/sales/orders", label: "Pedidos", icon: Receipt },
      { href: "/app/sales/cash", label: "Caixa", icon: Wallet },
      { href: "/app/sales/channels", label: "Canais", icon: Link2 },
    ],
  },
  {
    label: "Fiscal",
    items: [
      { href: "/app/fiscal/invoices", label: "Notas Fiscais", icon: FileText },
      { href: "/app/fiscal/settings", label: "Configurações", icon: Settings2 },
      { href: "/app/fiscal/skip-numbers", label: "Inutilização", icon: SkipForward },
    ],
  },
  {
    label: "Compras",
    items: [
      { href: "/app/purchasing/orders", label: "Pedidos", icon: Truck },
      { href: "/app/purchasing/receive", label: "Recebimento", icon: PackagePlus },
      { href: "/app/purchasing/returns", label: "Devoluções", icon: RotateCcw },
      { href: "/app/purchasing/suggestions", label: "Sugestões", icon: Sparkles },
      { href: "/app/purchasing/quotations", label: "Cotações", icon: ClipboardList },
      { href: "/app/purchasing/nfe-import", label: "Importar NFe", icon: Download },
      { href: "/app/purchasing/payables", label: "Contas a Pagar", icon: DollarSign },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/app/locations", label: "Unidades", icon: MapPin },
      { href: "/app/channels", label: "Canais de venda", icon: Radio },
      { href: "/app/suppliers", label: "Fornecedores", icon: Package },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/app/settings", label: "Organização", icon: Building2 },
      { href: "/app/settings/team", label: "Time", icon: Users },
      { href: "/app/audit", label: "Auditoria", icon: History },
    ],
  },
  {
    label: "Conta",
    items: [{ href: "/app/account", label: "Minha conta", icon: User }],
  },
];

/* ── NavLink ────────────────────────────────────────────────── */

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active =
    item.href === "/app"
      ? pathname === "/app"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium",
        "transition-all duration-150 select-none",
        active
          ? "bg-white/10 text-white"
          : "text-[--sidebar-foreground] hover:bg-white/[0.06] hover:text-white",
      )}
      style={active ? ({ "--sidebar-foreground": "inherit" } as React.CSSProperties) : undefined}
    >
      {/* Active indicator bar */}
      {active && (
        <span
          className="absolute left-0 top-1/2 h-[18px] w-0.5 -translate-y-1/2 rounded-r-full"
          style={{ background: "var(--sidebar-primary)" }}
          aria-hidden="true"
        />
      )}
      <item.icon
        className={cn(
          "h-[15px] w-[15px] shrink-0 transition-colors",
          active ? "opacity-100" : "opacity-50 group-hover:opacity-80",
        )}
        style={active ? { color: "var(--sidebar-primary)" } : undefined}
      />
      <span className={active ? "opacity-100" : "opacity-70 group-hover:opacity-100"}>
        {item.label}
      </span>
    </Link>
  );
}

/* ── Sidebar ────────────────────────────────────────────────── */

export function NavSidebar({ orgName }: { orgName: string }) {
  return (
    <aside
      className="flex h-screen w-[234px] shrink-0 flex-col border-r"
      style={{
        background: "var(--sidebar-background)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      {/* Brand */}
      <div
        className="flex h-[57px] shrink-0 items-center gap-2.5 border-b px-4"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: "var(--sidebar-primary)", color: "#fff" }}
        >
          <span className="text-[11px] font-bold leading-none">N</span>
        </div>
        <span
          className="text-sm font-semibold tracking-tight"
          style={{ color: "var(--sidebar-brand)" }}
        >
          NoHub Market
        </span>
      </div>

      {/* Org name chip */}
      <div
        className="shrink-0 border-b px-3 py-2.5"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <p
          className="truncate rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{
            color: "var(--sidebar-foreground)",
            background: "rgb(255 255 255 / 0.04)",
          }}
          title={orgName}
        >
          {orgName}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p
              className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: "var(--sidebar-foreground)", opacity: 0.35 }}
            >
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="flex h-12 shrink-0 items-center justify-between border-t px-3"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <span
          className="text-[10px] font-medium tracking-wide"
          style={{ color: "var(--sidebar-foreground)", opacity: 0.3 }}
        >
          v1.0
        </span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
