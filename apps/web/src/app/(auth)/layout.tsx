import { Globe, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

const HIGHLIGHTS = [
  { icon: Zap, text: "Onboarding em 10 minutos com auto-preenchimento de CNPJ e CEP" },
  { icon: Globe, text: "Omnichannel: iFood, WhatsApp, Mercado Livre e e-commerce próprio" },
  { icon: ShieldCheck, text: "Conformidade LGPD com exportação e exclusão de dados integradas" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left panel — Brand ───────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between p-10"
        style={{ background: "var(--sidebar-background)" }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 no-underline"
          style={{ color: "var(--sidebar-brand)" }}
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
            style={{ background: "var(--sidebar-primary)" }}
          >
            <span className="text-xs font-bold">N</span>
          </div>
          <span className="text-sm font-semibold">NoHub Market</span>
        </Link>

        {/* Hero copy */}
        <div className="space-y-4">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.15em]"
            style={{ color: "var(--sidebar-foreground)", opacity: 0.4 }}
          >
            SaaS para varejo de proximidade
          </p>
          <h2
            className="text-2xl font-bold leading-tight"
            style={{ color: "var(--sidebar-brand)" }}
          >
            O sistema que cresce com o seu negócio
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--sidebar-foreground)" }}>
            Mercados autônomos, conveniências e vendas online em uma só plataforma. Configure em
            minutos, opere com confiança.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="space-y-3">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-start gap-3 rounded-xl p-3.5 text-sm"
              style={{
                background: "rgb(255 255 255 / 0.05)",
                borderColor: "rgb(255 255 255 / 0.07)",
                border: "1px solid",
              }}
            >
              <div
                className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: "var(--sidebar-primary)", opacity: 0.85 }}
              >
                <Icon className="h-3.5 w-3.5 text-white" />
              </div>
              <p style={{ color: "var(--sidebar-foreground)", lineHeight: "1.5" }}>{text}</p>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-[11px]" style={{ color: "var(--sidebar-foreground)", opacity: 0.3 }}>
          © {new Date().getFullYear()} NoHub Market
        </p>
      </div>

      {/* ── Right panel — Form ────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        {/* Mobile logo */}
        <Link
          href="/"
          className="mb-10 flex items-center gap-2 text-foreground no-underline lg:hidden"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-xs font-bold">N</span>
          </div>
          <span className="text-sm font-semibold">NoHub Market</span>
        </Link>

        <div className="w-full max-w-[380px]">{children}</div>
      </div>
    </div>
  );
}
