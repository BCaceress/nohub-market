import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-sm font-bold tracking-tight">
            NoHub Market
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Termos
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacidade
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
      <footer className="border-t mt-16">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} NoHub Market. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
