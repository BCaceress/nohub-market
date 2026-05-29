import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptInviteButton } from "@/features/app/accept-invite-button";
import { getInvitationAction } from "@/features/app/actions/invite-actions";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Aceitar convite — NoHub Market" };

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Gerente",
  operator: "Operador",
  viewer: "Visualizador",
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [session, invitation] = await Promise.all([getSession(), getInvitationAction(token)]);

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Convite inválido</CardTitle>
            <CardDescription>Este convite não existe, foi revogado ou já expirou.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">Voltar ao início</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const orgName = invitation.organization.tradeName ?? invitation.organization.legalName;
  const expired = invitation.expiresAt < new Date();
  const alreadyUsed = invitation.status !== "pending";

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Convite para {orgName}</CardTitle>
          <CardDescription>
            {invitation.invitedBy?.name
              ? `${invitation.invitedBy.name} convidou você como`
              : "Você foi convidado como"}{" "}
            <strong>{ROLE_LABELS[invitation.role] ?? invitation.role}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {expired || alreadyUsed ? (
            <>
              <p className="text-sm text-center text-muted-foreground">
                {alreadyUsed
                  ? "Este convite já foi utilizado ou revogado."
                  : "Este convite expirou."}
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Voltar ao início</Link>
              </Button>
            </>
          ) : !session ? (
            <>
              <p className="text-sm text-center text-muted-foreground">
                Faça login com o e-mail <strong>{invitation.email}</strong> para aceitar.
              </p>
              <Button asChild className="w-full">
                <Link href={`/signin?redirect=/invite/${token}`}>Entrar e aceitar</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/signup?redirect=/invite/${token}`}>Criar conta e aceitar</Link>
              </Button>
            </>
          ) : session.user.email !== invitation.email ? (
            <>
              <p className="text-sm text-center text-muted-foreground">
                Este convite é para <strong>{invitation.email}</strong>.<br />
                Você está logado como <strong>{session.user.email}</strong>.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/app">Ir para o dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-center text-muted-foreground">
                Você entrará para a organização <strong>{orgName}</strong>.
              </p>
              <AcceptInviteButton token={token} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
