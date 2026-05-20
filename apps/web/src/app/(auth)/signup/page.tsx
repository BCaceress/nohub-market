import { SignUpForm } from "@/features/auth/signup-form";

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Criar conta</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Configure seu negócio em menos de 10 minutos
        </p>
      </div>
      <SignUpForm />
    </div>
  );
}
