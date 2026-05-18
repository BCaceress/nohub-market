import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 py-32 text-center">
        <span className="rounded-full border px-3 py-1 text-sm text-muted-foreground">
          NoHub Market · Etapa 1
        </span>
        <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-5xl">
          O sistema que cresce com seu negócio
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Mercados autônomos, conveniências e vendas online em uma só plataforma. Configure em
          minutos, opere com confiança.
        </p>
        <div className="mt-10 flex gap-4">
          <Link
            href="/signup"
            className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground"
          >
            Criar conta
          </Link>
          <Link href="/signin" className="rounded-md border px-6 py-3 font-medium">
            Entrar
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-32 sm:grid-cols-3">
        {[
          ["Onboarding em minutos", "Wizard de 6 passos com auto-preenchimento de CNPJ."],
          ["Multi-tenant", "Uma conta, várias unidades e CNPJs."],
          ["Configurável", "Capabilities adaptam o sistema ao seu tipo de negócio."],
        ].map(([title, desc]) => (
          <div key={title} className="rounded-lg border p-6">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} NoHub Market
      </footer>
    </main>
  );
}
