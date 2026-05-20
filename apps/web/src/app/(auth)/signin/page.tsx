import { SignInForm } from "@/features/auth/signin-form";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bem‑vindo de volta</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Entre na sua conta para continuar
        </p>
      </div>
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
