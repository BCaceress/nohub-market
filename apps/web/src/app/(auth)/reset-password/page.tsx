import { LockKeyhole } from "lucide-react";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-7">
      <div>
        <div
          className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{
            background: "var(--primary-soft)",
            border: "1px solid rgb(249 115 22 / 0.2)",
          }}
        >
          <LockKeyhole className="h-5 w-5" style={{ color: "var(--primary)" }} />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Redefinir senha</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Digite sua nova senha abaixo para recuperar o acesso.
        </p>
      </div>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
