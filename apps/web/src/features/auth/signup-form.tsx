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
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required autoComplete="name" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
        />
      </div>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input type="checkbox" name="acceptTerms" className="mt-1" required />
        <span>
          Li e aceito os{" "}
          <Link href="/terms" className="underline">
            Termos
          </Link>{" "}
          e a{" "}
          <Link href="/privacy" className="underline">
            Política de Privacidade
          </Link>
          .
        </span>
      </label>
      <Button type="submit" disabled={loading}>
        {loading ? "Criando..." : "Criar conta"}
      </Button>
      <Button type="button" variant="outline" onClick={google}>
        Continuar com Google
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/signin" className="underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
