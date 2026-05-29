"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <span className="text-2xl">⚠️</span>
      </div>
      <div>
        <h2 className="text-xl font-semibold">Algo deu errado</h2>
        <p className="text-muted-foreground text-sm mt-1 max-w-sm">
          {error.message || "Ocorreu um erro inesperado. Tente novamente."}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 mt-2 font-mono">ID: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset} variant="outline">
        Tentar novamente
      </Button>
    </div>
  );
}
