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
  ["Onboarding em minutos", "Wizard de 6 passos com auto-preenchimento de CNPJ pela Receita."],
  [
    "Multi-tenant de verdade",
    "Uma conta, várias unidades e CNPJs, papéis e permissões granulares.",
  ],
  [
    "Configurável por negócio",
    "Capabilities adaptam o sistema: mercado autônomo, conveniência ou bebidas.",
  ],
  ["Conformidade LGPD", "Consentimento versionado, exportação e exclusão de dados desde o dia 1."],
  ["Omnichannel", "Base pronta para iFood, WhatsApp, Mercado Livre e e-commerce próprio."],
  ["Auditoria completa", "Toda ação relevante registrada com autor e estado anterior."],
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-semibold">NoHub Market</span>
        <nav className="flex gap-4 text-sm">
          <Link href="/signin" className="text-muted-foreground hover:text-foreground">
            Entrar
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
          >
            Criar conta
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center sm:py-32">
        <span className="rounded-full border px-3 py-1 text-sm text-muted-foreground">
          SaaS para varejo de proximidade
        </span>
        <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-6xl">
          O sistema que cresce com seu negócio
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Mercados autônomos, conveniências e vendas online em uma só plataforma. Configure em
          minutos, opere com confiança.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground"
          >
            Começar agora
          </Link>
          <Link href="/signin" className="rounded-md border px-6 py-3 font-medium">
            Já tenho conta
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([title, desc]) => (
          <div key={title} className="rounded-lg border p-6">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </section>

      <section className="border-y bg-secondary/30">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Pronto para configurar seu negócio?</h2>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Crie sua conta e tenha a operação no ar em menos de 10 minutos.
          </p>
          <Link
            href="/signup"
            className="mt-8 rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground"
          >
            Criar conta gratuita
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} NoHub Market</span>
        <nav className="flex gap-4">
          <Link href="/terms" className="hover:text-foreground">
            Termos
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacidade
          </Link>
        </nav>
      </footer>
    </main>
  );
}
