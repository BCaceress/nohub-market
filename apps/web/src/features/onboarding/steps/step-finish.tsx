"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { finalizeOnboardingAction } from "../actions";
import { useOnboarding } from "../store";

const PAYMENTS = ["Pix", "Crédito", "Débito", "Dinheiro", "Vale-refeição"];

export function StepFinish() {
  const s = useOnboarding();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const togglePay = (p: string) =>
    s.set({
      paymentMethods: s.paymentMethods.includes(p)
        ? s.paymentMethods.filter((x) => x !== p)
        : [...s.paymentMethods, p],
    });

  async function finish() {
    if (!s.organizationId) return;
    setSaving(true);
    const res = await finalizeOnboardingAction({
      organizationId: s.organizationId,
      nfceEnabled: s.nfceEnabled,
      paymentMethods: s.paymentMethods,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success("Tudo pronto! Bem-vindo ao NoHub Market.");
    s.reset();
    router.push("/app");
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex items-center gap-3 rounded-lg border p-4 text-sm">
        <input
          type="checkbox"
          checked={s.nfceEnabled}
          onChange={(e) => s.set({ nfceEnabled: e.target.checked })}
        />
        Emitir NFC-e (nota fiscal do consumidor)
      </label>
      <div>
        <p className="mb-2 text-sm font-medium">Formas de pagamento</p>
        <div className="flex flex-wrap gap-2">
          {PAYMENTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePay(p)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm transition-colors",
                s.paymentMethods.includes(p)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-secondary",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <Button onClick={finish} disabled={saving}>
        {saving ? "Finalizando..." : "Concluir onboarding"}
      </Button>
    </div>
  );
}
