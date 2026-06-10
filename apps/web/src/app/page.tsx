import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Globe,
  Rocket,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "NoHub Market — O sistema que cresce com seu negócio",
  description:
    "Mercados autônomos, conveniências e vendas online em uma só plataforma. Configure em minutos, opere com confiança.",
  openGraph: {
    title: "NoHub Market",
    description: "Mercados autônomos, conveniências e vendas online em uma só plataforma.",
    type: "website",
    locale: "pt_BR",
  },
  alternates: { canonical: "/" },
};

const FEATURES = [
  {
    icon: Rocket,
    color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400",
    title: "Onboarding em minutos",
    desc: "Wizard de 6 passos com auto-preenchimento de CNPJ e CEP pela API do governo.",
  },
  {
    icon: Building2,
    color: "text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-400",
    title: "Multi-tenant de verdade",
    desc: "Uma conta, várias unidades e CNPJs. Papéis e permissões granulares por membro.",
  },
  {
    icon: SlidersHorizontal,
    color: "text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-400",
    title: "Configurável por negócio",
    desc: "Capabilities adaptam o sistema ao seu modelo: mercado autônomo, conveniência ou delivery.",
  },
  {
    icon: ShieldCheck,
    color: "text-green-600 bg-green-50 dark:bg-green-950/40 dark:text-green-400",
    title: "Conformidade LGPD",
    desc: "Consentimento versionado, exportação e exclusão de dados desde o primeiro acesso.",
  },
  {
    icon: Globe,
    color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 dark:text-cyan-400",
    title: "Omnichannel",
    desc: "Base pronta para iFood, WhatsApp, Mercado Livre e e-commerce próprio.",
  },
  {
    icon: ScrollText,
    color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400",
    title: "Auditoria completa",
    desc: "Toda ação relevante registrada com autor, timestamp e estado anterior.",
  },
] as const;

const STATS = [
  {
    value: "10min",
    label: "Configuração inicial",
    desc: "Wizard guiado com CNPJ e CEP automático",
  },
  {
    value: "3",
    label: "Segmentos atendidos",
    desc: "Conveniência, autônomo e delivery",
  },
  {
    value: "R$0",
    label: "Taxa de setup",
    desc: "Sem custo inicial, sem fidelidade",
  },
] as const;

const BENEFITS = [
  "Sem taxa de setup",
  "Cancele quando quiser",
  "Suporte por email e chat",
  "Atualizações contínuas",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 text-foreground no-underline">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-[11px] font-bold">N</span>
            </div>
            <span className="text-sm font-semibold tracking-tight">NoHub Market</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/signin"
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Entrar
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Criar conta
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border/50">
        {/* Warm radial glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% -10%, rgb(249 115 22 / 0.08) 0%, transparent 65%)",
          }}
        />
        {/* Dot grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center sm:py-32">
          {/* Pill badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            SaaS para varejo de proximidade
          </span>

          {/* Headline */}
          <h1 className="font-display mt-8 text-[2.75rem] font-bold leading-[1.08] tracking-tight sm:text-6xl lg:text-[4.5rem]">
            O sistema que cresce{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--primary) 0%, #fb923c 55%, #fbbf24 100%)",
              }}
            >
              com seu negócio
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Mercados autônomos, conveniências e vendas online em uma só plataforma. Configure em
            minutos, opere com confiança.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Começar agora — é grátis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-7 py-3.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
            >
              Já tenho conta
            </Link>
          </div>

          {/* Trust signals */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {BENEFITS.map((b) => (
              <span key={b} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────────── */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="overflow-hidden rounded-2xl border border-border bg-border">
            <div className="grid grid-cols-1 gap-px sm:grid-cols-3">
              {STATS.map(({ value, label, desc }) => (
                <div key={label} className="bg-card px-8 py-8 text-center">
                  <p className="font-display text-[2.5rem] font-bold leading-none text-foreground">
                    {value}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Tudo que sua operação precisa
          </h2>
          <p className="mt-3 text-muted-foreground">
            Uma plataforma completa, do cadastro ao omnichannel.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, color, title, desc }, i) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              {/* Ghost number decoration */}
              <span
                aria-hidden="true"
                className="font-display pointer-events-none absolute -right-1 -top-4 select-none text-[6rem] font-bold leading-none"
                style={{ color: "var(--foreground)", opacity: 0.025 }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              <div
                className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${color}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA section ─────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden border-y border-border"
        style={{ background: "var(--sidebar-background)" }}
      >
        {/* Dot grid texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.04) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Orange glow center */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 50% 50%, rgb(249 115 22 / 0.12) 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 py-20 text-center">
          <h2
            className="font-display text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ color: "var(--sidebar-brand)" }}
          >
            Pronto para configurar seu negócio?
          </h2>
          <p
            className="mt-4 max-w-lg text-sm leading-relaxed"
            style={{ color: "var(--sidebar-foreground)" }}
          >
            Crie sua conta e tenha a operação no ar em menos de 10 minutos. Sem cartão de crédito,
            sem contrato de fidelidade.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
          >
            Criar conta gratuita
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-[10px] font-bold">N</span>
            </div>
            <span className="text-sm font-semibold">NoHub Market</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} NoHub Market. Todos os direitos reservados.
          </p>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Termos
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacidade
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
