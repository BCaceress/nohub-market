import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountActions } from "@/features/app/account-actions";

export default function AccountPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Minha conta</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacidade e dados (LGPD)</CardTitle>
          <CardDescription>
            Você pode exportar todos os seus dados ou solicitar a exclusão da conta a qualquer
            momento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountActions />
        </CardContent>
      </Card>
    </div>
  );
}
