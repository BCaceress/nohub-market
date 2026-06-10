import { Globe, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

const HIGHLIGHTS = [
  { icon: Zap, text: "Onboarding em 10 minutos com auto-preenchimento de CNPJ e CEP" },
  { icon: Globe, text: "Omnichannel: iFood, WhatsApp, Mercado Livre e e-commerce próprio" },
  { icon: ShieldCheck, text: "Conformidade LGPD com exportação e exclusão de dados integradas" },
];

const STATS = [
  { value: "10min", label: "Setup" },
  { value: "3", label: "Segmentos" },
  { value: "100%", label: "LGPD" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left panel — Brand ───────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: "var(--sidebar-background)" }}
      >
        {/* Dot grid overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.04) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Orange glow — bottom-left */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 -left-48 h-[640px] w-[640px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgb(249 115 22 / 0.09) 0%, transparent 65%)",
          }}
        />

        {/* Orange glow — top-right accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full"
          style={{
            background: "radial-gradient(circle, rgb(249 115 22 / 0.05) 0%, transparent 70%)",
          }}
        />

        {/* ── Logo ── */}
        <Link
          href="/"
          className="relative flex w-fit items-center gap-2.5 no-underline"
          style={{ color: "var(--sidebar-brand)" }}
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: "var(--sidebar-primary)" }}
          >
            <span className="text-sm font-bold leading-none text-white">N</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">NoHub Market</span>
        </Link>

        {/* ── Hero copy + stats ── */}
        <div className="relative space-y-6">
          <div className="space-y-3">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--sidebar-primary)" }}
            >
              SaaS para varejo de proximidade
            </p>
            <h2
              className="font-display text-[2rem] font-bold leading-[1.1] tracking-tight"
              style={{ color: "var(--sidebar-brand)" }}
            >
              O sistema que cresce com o seu negócio
            </h2>
            <p
              className="max-w-sm text-sm leading-relaxed"
              style={{ color: "var(--sidebar-foreground)" }}
            >
              Mercados autônomos, conveniências e vendas online em uma só plataforma.
            </p>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-2.5">
            {STATS.map(({ value, label }) => (
              <div
                key={label}
                className="rounded-xl px-3 py-3.5"
                style={{
                  background: "rgb(249 115 22 / 0.07)",
                  border: "1px solid rgb(249 115 22 / 0.15)",
                }}
              >
                <p
                  className="font-display text-2xl font-bold leading-none"
                  style={{ color: "var(--sidebar-primary)" }}
                >
                  {value}
                </p>
                <p
                  className="mt-1.5 text-[10px] uppercase tracking-wide"
                  style={{ color: "var(--sidebar-foreground)", opacity: 0.5 }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Feature highlights ── */}
        <div className="relative space-y-2">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-start gap-3 rounded-xl p-3.5"
              style={{
                background: "rgb(255 255 255 / 0.03)",
                border: "1px solid rgb(255 255 255 / 0.06)",
              }}
            >
              <div
                className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: "rgb(249 115 22 / 0.1)",
                  border: "1px solid rgb(249 115 22 / 0.2)",
                }}
              >
                <Icon className="h-3 w-3" style={{ color: "var(--sidebar-primary)" }} />
              </div>
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--sidebar-foreground)", opacity: 0.68 }}
              >
                {text}
              </p>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <p
          className="relative text-[11px]"
          style={{ color: "var(--sidebar-foreground)", opacity: 0.25 }}
        >
          © {new Date().getFullYear()} NoHub Market
        </p>
      </div>

      {/* ── Right panel — Form ────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        {/* Warm ambient glow at top */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-64"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 0%, rgb(249 115 22 / 0.05) 0%, transparent 100%)",
          }}
        />

        {/* Mobile logo */}
        <Link
          href="/"
          className="relative mb-10 flex items-center gap-2.5 text-foreground no-underline lg:hidden"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-sm font-bold">N</span>
          </div>
          <span className="text-sm font-semibold">NoHub Market</span>
        </Link>

        <div className="relative w-full max-w-[380px]">{children}</div>
      </div>
    </div>
  );
}
