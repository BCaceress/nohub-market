"use client";

import {
  AlertTriangle,
  Bell,
  ChevronDown,
  CircleHelp,
  FileWarning,
  LifeBuoy,
  LogOut,
  Maximize2,
  Minimize2,
  Package,
  Plus,
  Receipt,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  User,
  UserPlus,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

type CashState = { open: true; locationName: string; openedAt: string } | { open: false };

interface NotificationCounts {
  lowStock: number;
  onlinePending: number;
  nfeIssues: number;
  payablesDue: number;
  total: number;
}

interface AppTopbarProps {
  userName: string;
  userEmail: string;
  userInitials: string;
  cash?: CashState;
  notifications?: NotificationCounts;
  fiscalLevel?: "ok" | "warn" | "error";
}

const EMPTY_NOTIFICATIONS: NotificationCounts = {
  lowStock: 0,
  onlinePending: 0,
  nfeIssues: 0,
  payablesDue: 0,
  total: 0,
};

export function AppTopbar({
  userName,
  userEmail,
  userInitials,
  cash = { open: false },
  notifications = EMPTY_NOTIFICATIONS,
  fiscalLevel = "ok",
}: AppTopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K opens search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-6",
        )}
      >
        {/* Search trigger */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className={cn(
            "group flex h-9 flex-1 max-w-[440px] items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] text-muted-foreground shadow-xs",
            "transition-colors duration-150 hover:bg-surface-1 hover:border-border-strong",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Buscar produtos, pedidos, clientes…</span>
          <span className="sm:hidden">Buscar…</span>
          <span className="ml-auto flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <div className="flex-1" />

        {/* Cash status */}
        <CashChip cash={cash} />

        {/* Fiscal health */}
        <FiscalDot level={fiscalLevel} />

        {/* Quick create — multi-ação */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "hidden h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-sm",
              "transition-colors duration-150 hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] sm:inline-flex",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label="Criar"
          >
            <Plus className="h-3.5 w-3.5" />
            Criar
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[230px] rounded-xl border-border bg-popover p-1.5 shadow-lg"
          >
            {QUICK_CREATE.map((item) => (
              <DropdownMenuItem key={item.href} asChild className="rounded-md text-[13px]">
                <Link href={item.href}>
                  <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <NotificationBell notifications={notifications} />

        {/* Fullscreen */}
        <FullscreenToggle />

        {/* Help */}
        <Link
          href="https://nohub.com.br/help"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "hidden h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-xs md:flex",
            "transition-colors duration-150 hover:bg-surface-1 hover:text-foreground hover:border-border-strong",
          )}
          aria-label="Ajuda"
        >
          <CircleHelp className="h-4 w-4" />
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card pl-1 pr-2.5 text-[13px] font-medium text-foreground shadow-xs",
              "transition-colors duration-150 hover:bg-surface-1 hover:border-border-strong",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background font-display text-[11px] font-bold">
              {userInitials}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[260px] rounded-xl border-border bg-popover p-1.5 shadow-lg"
          >
            <div className="flex items-center gap-3 rounded-lg bg-surface-1 px-2 py-2 mb-1">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background font-display text-[13px] font-bold">
                {userInitials}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[13px] font-semibold">{userName}</p>
                <p className="truncate text-[11px] text-muted-foreground">{userEmail}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="rounded-md text-[13px]">
              <Link href="/app/account">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Minha conta
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-md text-[13px]">
              <Link href="/app/settings">
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                Preferências
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-md text-[13px]">
              <Link href="https://nohub.com.br/help" target="_blank" rel="noopener noreferrer">
                <LifeBuoy className="h-3.5 w-3.5 text-muted-foreground" />
                Suporte
              </Link>
            </DropdownMenuItem>
            <div className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px]">
              <span className="text-muted-foreground">Tema</span>
              <ThemeToggle />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              asChild
              className="rounded-md text-[13px] text-destructive focus:bg-destructive-soft"
            >
              <Link href="/api/auth/signout">
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
    </>
  );
}

/* ───────────────────────────────────────────────────────────────
   Fullscreen toggle — expande o sistema (ideal para PDV em tablet)
   ─────────────────────────────────────────────────────────────── */

function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
      title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
      className={cn(
        "hidden h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-xs md:flex",
        "transition-colors duration-150 hover:bg-surface-1 hover:text-foreground hover:border-border-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </button>
  );
}

/* ───────────────────────────────────────────────────────────────
   Quick-create menu — ações de criação mais comuns
   ─────────────────────────────────────────────────────────────── */

const QUICK_CREATE = [
  { href: "/app/sales/pos", label: "Nova venda", icon: ShoppingCart },
  { href: "/app/products/new", label: "Cadastrar produto", icon: Package },
  { href: "/app/purchasing/orders", label: "Pedido de compra", icon: ShoppingBag },
  { href: "/app/customers/new", label: "Novo cliente", icon: UserPlus },
];

/* ───────────────────────────────────────────────────────────────
   Cash status chip — caixa aberto/fechado
   ─────────────────────────────────────────────────────────────── */

function CashChip({ cash }: { cash: CashState }) {
  return (
    <Link
      href="/app/sales/cash"
      className={cn(
        "hidden h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-[12px] font-medium shadow-xs md:inline-flex",
        "transition-colors duration-150 hover:bg-surface-1 hover:border-border-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      aria-label={cash.open ? "Caixa aberto" : "Caixa fechado"}
    >
      <Wallet className="h-4 w-4 text-muted-foreground" />
      {cash.open ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="text-foreground">Caixa aberto</span>
          <span className="hidden text-muted-foreground lg:inline">· {cash.locationName}</span>
        </>
      ) : (
        <span className="text-muted-foreground">Caixa fechado</span>
      )}
    </Link>
  );
}

/* ───────────────────────────────────────────────────────────────
   Fiscal health dot — status do emissor NF-e
   ─────────────────────────────────────────────────────────────── */

const FISCAL_META: Record<"ok" | "warn" | "error", { dot: string; label: string }> = {
  ok: { dot: "bg-success", label: "Emissor fiscal em produção" },
  warn: { dot: "bg-warning", label: "Emissor fiscal em homologação" },
  error: { dot: "bg-destructive", label: "Notas fiscais com rejeição" },
};

function FiscalDot({ level }: { level: "ok" | "warn" | "error" }) {
  const meta = FISCAL_META[level];
  return (
    <Link
      href="/app/fiscal/invoices"
      title={meta.label}
      className={cn(
        "hidden h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-xs md:flex",
        "transition-colors duration-150 hover:bg-surface-1 hover:text-foreground hover:border-border-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      aria-label={meta.label}
    >
      <span className="relative">
        <Receipt className="h-4 w-4" />
        <span
          className={cn("absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-card", meta.dot)}
        />
      </span>
    </Link>
  );
}

/* ───────────────────────────────────────────────────────────────
   Notification bell — alertas operacionais reais
   ─────────────────────────────────────────────────────────────── */

function NotificationBell({ notifications }: { notifications: NotificationCounts }) {
  const items = [
    {
      key: "nfe",
      count: notifications.nfeIssues,
      href: "/app/fiscal/invoices",
      icon: FileWarning,
      label: "Notas fiscais rejeitadas",
      tone: "text-destructive",
    },
    {
      key: "online",
      count: notifications.onlinePending,
      href: "/app/sales/online",
      icon: ShoppingBag,
      label: "Pedidos online aguardando",
      tone: "text-foreground",
    },
    {
      key: "stock",
      count: notifications.lowStock,
      href: "/app/inventory",
      icon: Package,
      label: "Itens abaixo do mínimo",
      tone: "text-warning",
    },
    {
      key: "payables",
      count: notifications.payablesDue,
      href: "/app/purchasing/payables",
      icon: AlertTriangle,
      label: "Contas a pagar vencendo",
      tone: "text-warning",
    },
  ].filter((i) => i.count > 0);

  const total = notifications.total;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-xs",
          "transition-colors duration-150 hover:bg-surface-1 hover:text-foreground hover:border-border-strong",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        aria-label="Notificações"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground ring-2 ring-background">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[320px] rounded-xl border-border bg-popover p-1 shadow-lg"
      >
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle px-2 pt-1.5 pb-1">
          Notificações
        </DropdownMenuLabel>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <Bell className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-[12px] text-muted-foreground">Tudo em dia — nada novo.</p>
          </div>
        ) : (
          <div className="py-0.5">
            {items.map((item) => (
              <DropdownMenuItem key={item.key} asChild className="rounded-md text-[13px]">
                <Link href={item.href}>
                  <item.icon className={cn("h-4 w-4", item.tone)} />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {item.count}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ───────────────────────────────────────────────────────────────
   Command palette — lightweight inline; no external dependency
   ─────────────────────────────────────────────────────────────── */

const QUICK_LINKS = [
  { href: "/app/sales/pos", label: "Abrir PDV", hint: "PDV", icon: Plus },
  { href: "/app/products", label: "Catálogo de produtos", hint: "Produtos", icon: Search },
  { href: "/app/products/new", label: "Cadastrar produto", hint: "Produtos", icon: Plus },
  { href: "/app/inventory", label: "Estoque — visão geral", hint: "Estoque", icon: Search },
  { href: "/app/sales/online", label: "Pedidos online", hint: "Online", icon: Search },
  { href: "/app/fiscal/invoices", label: "Notas fiscais", hint: "Fiscal", icon: Search },
  { href: "/app/settings", label: "Configurações", hint: "Sistema", icon: Settings },
];

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = QUICK_LINKS.filter(
    (l) =>
      l.label.toLowerCase().includes(query.toLowerCase()) ||
      l.hint.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Fechar busca"
        className="dialog-overlay-animate fixed inset-0 bg-[rgb(26_24_20/0.55)] backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div className="dialog-content-animate relative z-10 w-full max-w-[560px] overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produtos, pedidos, clientes ou atalhos…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          <Kbd>ESC</Kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              Nenhum atalho corresponde a “{query}”.
            </p>
          ) : (
            filtered.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] text-foreground transition-colors hover:bg-surface-1"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-1 text-muted-foreground">
                  <link.icon className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 font-medium">{link.label}</span>
                <span className="text-[11px] text-muted-foreground">{link.hint}</span>
              </Link>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-surface-1/40 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> abrir
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd> alternar
          </span>
        </div>
      </div>
    </div>
  );
}
