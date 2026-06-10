"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    setLoading(true);
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setLoading(false);
    setSent(true);
    toast.success("Se o email existir, enviamos um link de redefinição.");
  }

  if (sent) {
    return (
      <div
        className="rounded-xl px-4 py-4 text-sm"
        style={{
          background: "var(--success-soft)",
          border: "1px solid rgb(21 128 61 / 0.2)",
        }}
      >
        <p className="font-semibold" style={{ color: "var(--success)" }}>
          Email enviado!
        </p>
        <p className="mt-1 text-muted-foreground">
          Verifique sua caixa de entrada e a pasta de spam.{" "}
          <Link href="/signin" className="font-medium text-foreground hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="seu@email.com"
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Enviando…" : "Enviar link de redefinição"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Lembrou a senha?{" "}
        <Link href="/signin" className="font-medium text-foreground hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
