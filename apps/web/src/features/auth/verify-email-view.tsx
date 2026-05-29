"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function VerifyEmailView() {
  const email = useSearchParams().get("email") ?? "";
  const [loading, setLoading] = useState(false);

  async function resend() {
    if (!email) return;
    setLoading(true);
    await authClient.sendVerificationEmail({ email, callbackURL: "/onboarding" });
    setLoading(false);
    toast.success("Email reenviado.");
  }

  return (
    <div className="flex flex-col gap-4 text-center">
      <p className="text-sm text-muted-foreground">
        Enviamos um link de confirmação para{" "}
        <strong className="text-foreground">{email || "seu email"}</strong>. Confirme para acessar o
        NoHub Market.
      </p>
      <Button onClick={resend} disabled={loading || !email} variant="outline">
        {loading ? "Reenviando..." : "Reenviar email"}
      </Button>
    </div>
  );
}
