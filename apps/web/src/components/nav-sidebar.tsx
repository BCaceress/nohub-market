"use client";

import { cn } from "@/lib/utils";
import {
  BarChart3,
  Boxes,
  Building2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  DollarSign,
  Download,
  FileText,
  History,
  Link2,
  MapPin,
  Package,
  PackagePlus,
  Radio,
  Receipt,
  RotateCcw,
  Settings,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  SkipForward,
  Sparkles,
  Truck,
  User,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

/* ── Types ──────────────────────────────────────────────────── */

type Role = "owner" | "admin" | "manager" | "operator" | "viewer";

type NavLeaf = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: Role[];
  badge?: string;
};

type NavRoot = {
  key: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  roles?: Role[];
  children?: NavLeaf[];
};

const ALL: Role[] = ["owner", "admin", "manager", "operator", "viewer"];
const MGMT: Role[] = ["owner", "admin", "manager"];
const ADMIN: Role[] = ["owner", "admin"];

/* ── Tree ────────────────────────────────────────────────────── */

const NAV: NavRoot[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: BarChart3,
    href: "/app",
    roles: ALL,
  },
  {
    key: "sales",
    label: "Vendas",
    icon: ShoppingCart,
    roles: ALL,
    children: [
      { href: "/app/sales/pos", label: "PDV", icon: ShoppingCart, roles: ALL },
      { href: "/app/sales/cash", label: "Caixa", icon: Wallet, roles: ALL },
      { href: "/app/sales/orders", label: "Pedidos", icon: Receipt, roles: MGMT },
      { href: "/app/sales/channels", label: "Canais de venda", icon: Link2, roles: MGMT },
    ],
  },
  {
    key: "catalog",
    label: "Produtos",
    icon: ShoppingBag,
    href: "/app/products",
    roles: MGMT.concat("viewer"),
  },
  {
    key: "inventory",
    label: "Estoque",
    icon: Boxes,
    href: "/app/inventory",
    roles: MGMT.concat("viewer"),
  },
  {
    key: "purchasing",
    label: "Compras",
    icon: Truck,
    roles: MGMT,
    children: [
      { href: "/app/purchasing/orders", label: "Pedidos", icon: Truck, roles: MGMT },
      { href: "/app/purchasing/receive", label: "Recebimento", icon: PackagePlus, roles: MGMT },
      { href: "/app/purchasing/nfe-import", label: "Importar NFe", icon: Download, roles: MGMT },
      { href: "/app/purchasing/payables", label: "Contas a pagar", icon: DollarSign, roles: MGMT },
      { href: "/app/purchasing/suggestions", label: "Sugestões", icon: Sparkles, roles: MGMT },
      { href: "/app/purchasing/quotations", label: "Cotações", icon: ClipboardList, roles: MGMT },
      { href: "/app/purchasing/returns", label: "Devoluções", icon: RotateCcw, roles: MGMT },
    ],
  },
  {
    key: "settings",
    label: "Configurar",
    icon: Settings,
    roles: ADMIN,
    children: [
      { href: "/app/settings", label: "Organização", icon: Building2, roles: ADMIN },
      { href: "/app/settings/team", label: "Time", icon: Users, roles: ADMIN },
      { href: "/app/locations", label: "Unidades", icon: MapPin, roles: ADMIN },
      { href: "/app/channels", label: "Canais", icon: Radio, roles: ADMIN },
      { href: "/app/suppliers", label: "Fornecedores", icon: Package, roles: ADMIN },
      { href: "/app/fiscal/invoices", label: "Notas fiscais", icon: FileText, roles: ADMIN },
      { href: "/app/fiscal/settings", label: "Fiscal", icon: Settings2, roles: ADMIN },
      { href: "/app/fiscal/skip-numbers", label: "Inutilização", icon: SkipForward, roles: ADMIN },
      { href: "/app/audit", label: "Auditoria", icon: History, roles: ADMIN },
    ],
  },
];

/* ── Visibility helpers ─────────────────────────────────────── */

function allowed(roles: Role[] | undefined, role: Role): boolean {
  if (!roles) return true;
  return roles.includes(role);
}

function filterTree(tree: NavRoot[], role: Role): NavRoot[] {
  return tree
    .filter((r) => allowed(r.roles, role))
    .map((r) => {
      if (!r.children) return r;
      const children = r.children.filter((c) => allowed(c.roles, role));
      return { ...r, children };
    })
    .filter((r) => !r.children || r.children.length > 0);
}

function isPathActive(href: string, pathname: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function rootActiveKey(roots: NavRoot[], pathname: string): string | null {
  for (const r of roots) {
    if (r.href && isPathActive(r.href, pathname)) return r.key;
    if (r.children?.some((c) => isPathActive(c.href, pathname))) return r.key;
  }
  return null;
}

/* ── Persistence ────────────────────────────────────────────── */

const COLLAPSE_KEY = "nohub-sidebar-collapsed";
const OPEN_KEY = "nohub-sidebar-open";

/* ── Sidebar ────────────────────────────────────────────────── */

export function NavSidebar({
  orgName,
  role,
}: {
  orgName: string;
  role: string;
}) {
  const safeRole = (
    ["owner", "admin", "manager", "operator", "viewer"].includes(role) ? role : "viewer"
  ) as Role;
  const pathname = usePathname();

  const tree = useMemo(() => filterTree(NAV, safeRole), [safeRole]);
  const activeKey = useMemo(() => rootActiveKey(tree, pathname), [tree, pathname]);

  const [collapsed, setCollapsed] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(activeKey);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedCollapsed = localStorage.getItem(COLLAPSE_KEY);
    if (storedCollapsed === "1") setCollapsed(true);
    const storedOpen = localStorage.getItem(OPEN_KEY);
    if (storedOpen) setOpenKey(storedOpen);
    setHydrated(true);
  }, []);

  // Auto-open the section that matches current route.
  useEffect(() => {
    if (activeKey && activeKey !== openKey) {
      setOpenKey(activeKey);
      localStorage.setItem(OPEN_KEY, activeKey);
    }
  }, [activeKey, openKey]);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const toggleSection = (key: string) => {
    setOpenKey((prev) => {
      const next = prev === key ? null : key;
      if (next) localStorage.setItem(OPEN_KEY, next);
      return next;
    });
  };

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        "relative flex h-screen shrink-0 flex-col border-r transition-[width] duration-200",
        hydrated && collapsed ? "w-[64px]" : "w-[232px]",
        !hydrated && "w-[232px]",
      )}
      style={{
        background: "var(--sidebar-background)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b",
          collapsed ? "justify-center px-2" : "gap-2.5 px-3.5",
        )}
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md shadow-md"
          style={{
            background: "linear-gradient(135deg, var(--sidebar-primary) 0%, #EA580C 100%)",
            color: "#fff",
          }}
        >
          <span className="font-display text-[13px] font-bold leading-none">N</span>
        </div>
        {!collapsed && (
          <div className="flex flex-1 flex-col leading-tight">
            <span
              className="font-display text-[14px] font-semibold tracking-tight"
              style={{ color: "var(--sidebar-brand)" }}
            >
              NoHub Market
            </span>
            <span
              className="truncate text-[10.5px] font-medium uppercase tracking-[0.12em] opacity-50"
              style={{ color: "var(--sidebar-foreground)" }}
              title={orgName}
            >
              {orgName}
            </span>
          </div>
        )}
      </div>

      {/* Nav body */}
      <nav
        data-scrollarea="sidebar"
        className={cn(
          "flex flex-1 flex-col overflow-y-auto overflow-x-visible py-3",
          collapsed ? "px-2 gap-1" : "px-2 gap-0.5",
        )}
      >
        {tree.map((root) => (
          <RootItem
            key={root.key}
            root={root}
            collapsed={collapsed}
            open={openKey === root.key}
            active={activeKey === root.key}
            pathname={pathname}
            onToggle={() => toggleSection(root.key)}
          />
        ))}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "flex shrink-0 flex-col border-t",
          collapsed ? "items-center gap-1 px-2 py-2" : "gap-1 px-2 py-2",
        )}
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <AccountLink collapsed={collapsed} pathname={pathname} />
        <button
          type="button"
          onClick={toggleCollapse}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "flex items-center rounded-md text-[12px] transition-colors hover:bg-[var(--sidebar-hover)]",
            collapsed ? "h-8 w-8 justify-center" : "h-8 w-full justify-between px-2.5",
          )}
          style={{ color: "var(--sidebar-foreground)" }}
        >
          {!collapsed && <span className="font-mono text-[10px] opacity-40">v1.0</span>}
          {collapsed ? (
            <ChevronsRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronsLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </aside>
  );
}

/* ── Root item with accordion + collapsed flyout ────────────── */

function RootItem({
  root,
  collapsed,
  open,
  active,
  pathname,
  onToggle,
}: {
  root: NavRoot;
  collapsed: boolean;
  open: boolean;
  active: boolean;
  pathname: string;
  onToggle: () => void;
}) {
  const Icon = root.icon;
  const hasChildren = !!root.children && root.children.length > 0;
  const children = root.children ?? [];

  // Flyout for collapsed mode.
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enter = () => {
    if (!collapsed) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFlyoutOpen(true), 80);
  };
  const leave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFlyoutOpen(false), 120);
  };

  // Base row content (icon + label).
  const rowBase = cn(
    "group relative flex h-9 w-full items-center rounded-lg text-[13px] font-medium select-none",
    "transition-[background-color,color] duration-150",
    collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
    active
      ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-foreground)]"
      : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-foreground-strong)]",
  );

  const indicator = (
    <span
      aria-hidden="true"
      className={cn(
        "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--sidebar-primary)]",
        "transition-opacity duration-200",
        active ? "opacity-100" : "opacity-0",
      )}
    />
  );

  const iconEl = (
    <Icon
      className={cn(
        "h-[17px] w-[17px] shrink-0 transition-colors",
        active
          ? "text-[var(--sidebar-primary)]"
          : "text-[var(--sidebar-foreground)] group-hover:text-[var(--sidebar-foreground-strong)]",
      )}
    />
  );

  // Standalone leaf root (e.g. Dashboard).
  const standaloneHref = !hasChildren ? root.href : undefined;

  return (
    <div ref={wrapperRef} className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      {standaloneHref ? (
        <Link href={standaloneHref} className={rowBase} aria-current={active ? "page" : undefined}>
          {indicator}
          {iconEl}
          {!collapsed && <span className="flex-1 truncate">{root.label}</span>}
        </Link>
      ) : collapsed && children[0] ? (
        <Link
          href={children[0].href}
          className={rowBase}
          aria-current={active ? "page" : undefined}
        >
          {indicator}
          {iconEl}
        </Link>
      ) : (
        <button type="button" onClick={onToggle} className={rowBase} aria-expanded={open}>
          {indicator}
          {iconEl}
          <span className="flex-1 truncate text-left">{root.label}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 opacity-50 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      )}

      {/* Expanded accordion children */}
      {!collapsed && hasChildren && open && (
        <ul className="mt-0.5 flex flex-col gap-0.5 pb-1 pl-[34px] pr-1">
          {children.map((c) => (
            <SubLink key={c.href} item={c} pathname={pathname} />
          ))}
        </ul>
      )}

      {/* Collapsed flyout */}
      {collapsed && hasChildren && flyoutOpen && (
        <div
          className="absolute left-full top-0 z-40 ml-2 min-w-[200px] animate-in-right"
          onMouseEnter={enter}
          onMouseLeave={leave}
        >
          <div
            className="overflow-hidden rounded-lg border shadow-lg"
            style={{
              background: "var(--sidebar-background)",
              borderColor: "var(--sidebar-border)",
            }}
          >
            <div
              className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em]"
              style={{
                color: "var(--sidebar-foreground-strong)",
                borderColor: "var(--sidebar-border)",
              }}
            >
              {root.label}
            </div>
            <ul className="flex flex-col gap-0.5 p-1.5">
              {children.map((c) => (
                <SubLink key={c.href} item={c} pathname={pathname} compact />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Child link ─────────────────────────────────────────────── */

function SubLink({
  item,
  pathname,
  compact,
}: {
  item: NavLeaf;
  pathname: string;
  compact?: boolean;
}) {
  const active = isPathActive(item.href, pathname);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] transition-colors",
          compact ? "h-8" : "h-7",
          active
            ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-foreground)]"
            : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-foreground-strong)]",
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            active ? "text-[var(--sidebar-primary)]" : "opacity-60",
          )}
        />
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge && (
          <span className="rounded-md bg-[var(--sidebar-primary)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}

/* ── Account footer link ────────────────────────────────────── */

function AccountLink({
  collapsed,
  pathname,
}: {
  collapsed: boolean;
  pathname: string;
}) {
  const active = isPathActive("/app/account", pathname);
  return (
    <Link
      href="/app/account"
      className={cn(
        "group flex items-center rounded-md text-[12.5px] font-medium transition-colors",
        collapsed ? "h-8 w-8 justify-center" : "h-8 gap-2.5 px-2.5",
        active
          ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-foreground)]"
          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-foreground-strong)]",
      )}
      aria-label="Minha conta"
    >
      <User
        className={cn(
          "h-[15px] w-[15px] shrink-0",
          active ? "text-[var(--sidebar-primary)]" : "opacity-70",
        )}
      />
      {!collapsed && <span className="flex-1 truncate">Minha conta</span>}
    </Link>
  );
}
