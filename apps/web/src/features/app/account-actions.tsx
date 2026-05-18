"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function AccountActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (
      !confirm(
        "Excluir sua conta apaga permanentemente seus dados. Esta ação é irreversível. Continuar?",
      )
    )
      return;
    setBusy(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json();
      toast.error(error ?? "Não foi possível excluir");
      return;
    }
    toast.success("Conta excluída.");
    router.push("/");
  }

  return (
    <div className="flex flex-col gap-3">
      <Button asChild variant="outline">
        <a href="/api/account/export">Exportar meus dados (LGPD)</a>
      </Button>
      <Button variant="outline" onClick={remove} disabled={busy}>
        {busy ? "Excluindo..." : "Excluir minha conta (LGPD)"}
      </Button>
    </div>
  );
}
