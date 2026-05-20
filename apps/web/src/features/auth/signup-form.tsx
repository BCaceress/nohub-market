"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { signUpSchema } from "@nohub/shared/schemas";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { recordConsent } from "./consent-action";

export function SignUpForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      name: fd.get("name"),
      email: fd.get("email"),
      password: fd.get("password"),
      acceptTerms: fd.get("acceptTerms") === "on",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    const { error } = await authClient.signUp.email({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      setLoading(false);
      toast.error(error.message ?? "Não foi possível criar a conta");
      return;
    }
    await recordConsent(parsed.data.email);
    toast.success("Conta criada! Verifique seu email.");
    router.push(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
  }

  async function google() {
    await authClient.signIn.social({ provider: "google", callbackURL: "/app" });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Nome completo</Label>
        <Input
          id="name"
          name="name"
          required
          autoComplete="name"
          placeholder="João Silva"
        />
      </div>

      {/* Email */}
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

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      {/* Terms */}
      <label className="flex items-start gap-3 text-sm text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          name="acceptTerms"
          required
          className="mt-0.5 h-4 w-4 shrink-0 rounded border border-input accent-primary cursor-pointer"
        />
        <span>
          Li e aceito os{" "}
          <Link href="/terms" target="_blank" className="font-medium text-foreground hover:underline">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-foreground hover:underline">
            Política de Privacidade
          </Link>
          .
        </span>
      </label>

      {/* Submit */}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Criando conta…" : "Criar conta"}
      </Button>

      {/* Divider */}
      <div className="relative flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex-1 border-t border-border" />
        <span>ou</span>
        <span className="flex-1 border-t border-border" />
      </div>

      {/* Google */}
      <Button type="button" variant="outline" className="w-full gap-2.5" onClick={google}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continuar com Google
      </Button>

      {/* Link to signin */}
      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/signin" className="font-medium text-foreground hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
