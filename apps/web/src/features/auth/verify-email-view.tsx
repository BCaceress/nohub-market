"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function VerifyEmailView() {
  const email = useSearchParams().get("email") ?? "";
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend() {
    if (!email) return;
    setLoading(true);
    await authClient.sendVerificationEmail({ email, callbackURL: "/onboarding" });
    setLoading(false);
    setSent(true);
    toast.success("Email reenviado.");
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Enviamos o link para{" "}
        <strong className="font-semibold text-foreground">{email || "seu email"}</strong>. Verifique
        a caixa de entrada e a pasta de spam.
      </p>

      {sent ? (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: "var(--success-soft)",
            border: "1px solid rgb(21 128 61 / 0.2)",
            color: "var(--success)",
          }}
        >
          Email reenviado com sucesso.
        </div>
      ) : (
        <Button onClick={resend} disabled={loading || !email} variant="outline" className="w-full">
          {loading ? "Reenviando…" : "Reenviar email de confirmação"}
        </Button>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Email errado?{" "}
        <Link href="/signup" className="font-medium text-foreground hover:underline">
          Criar nova conta
        </Link>
      </p>
    </div>
  );
}
