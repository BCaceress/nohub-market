import { CapabilitiesProvider } from "@/features/app/capabilities-provider";
import { getSession } from "@/lib/auth-server";
import { getCapabilities } from "@/lib/capabilities";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/signin?redirect=/app");
  if (!session.user.emailVerified)
    redirect(`/verify-email?email=${encodeURIComponent(session.user.email)}`);

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "desc" },
  });

  // Gate de onboarding (RN-11): sem org completa volta ao wizard.
  if (!member || !member.organization.onboardingCompleted) {
    redirect("/onboarding");
  }

  const caps = await getCapabilities(member.organizationId);
  const capsObject = Object.fromEntries(caps);

  return (
    <CapabilitiesProvider value={capsObject}>
      <div className="min-h-screen bg-background">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <span className="font-semibold">NoHub Market</span>
          <span className="text-sm text-muted-foreground">
            {member.organization.tradeName ?? member.organization.legalName}
          </span>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </div>
    </CapabilitiesProvider>
  );
}
