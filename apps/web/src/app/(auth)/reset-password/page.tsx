import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Redefinir senha</CardTitle>
      </CardHeader>
      <CardContent>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
