import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <p className="text-8xl font-black text-muted-foreground/30">404</p>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-muted-foreground max-w-sm">
        A página que você procura não existe ou foi movida.
      </p>
      <div className="flex gap-3 mt-2">
        <Button asChild>
          <Link href="/app">Ir para o dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Página inicial</Link>
        </Button>
      </div>
    </div>
  );
}
