import { NavSidebar } from "@/components/nav-sidebar";
import { CapabilitiesProvider } from "@/features/app/capabilities-provider";
import { getSession } from "@/lib/auth-server";
import { getCapabilities } from "@/lib/capabilities";
import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin?redirect=/app");
  if (!session.user.emailVerified)
    redirect(`/verify-email?email=${encodeURIComponent(session.user.email)}`);

  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "desc" },
  });

  if (!member || !member.organization.onboardingCompleted) {
    redirect("/onboarding");
  }

  const caps = await getCapabilities(member.organizationId);
  const capsObject = Object.fromEntries(caps);
  const orgName = member.organization.tradeName ?? member.organization.legalName;

  return (
    <CapabilitiesProvider value={capsObject}>
      <div className="flex h-screen overflow-hidden bg-background">
        <NavSidebar orgName={orgName} />

        {/* Content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-8 py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </CapabilitiesProvider>
  );
}
