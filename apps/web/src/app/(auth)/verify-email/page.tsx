import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerifyEmailView } from "@/features/auth/verify-email-view";
import { Suspense } from "react";

export default function VerifyEmailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirme seu email</CardTitle>
      </CardHeader>
      <CardContent>
        <Suspense>
          <VerifyEmailView />
        </Suspense>
      </CardContent>
    </Card>
  );
}
