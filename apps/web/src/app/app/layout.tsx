import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
import { NavSidebar } from "@/components/nav-sidebar";
import { CapabilitiesProvider } from "@/features/app/capabilities-provider";
import { getSession } from "@/lib/auth-server";
import { getCapabilities } from "@/lib/capabilities";
import { ALL_LOCATIONS } from "@/lib/selected-location";
import { readSelectedLocation } from "@/lib/selected-location-server";

function getInitials(name: string | null | undefined, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return (first + last).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

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

  if (!member?.organization.onboardingCompleted) {
    redirect("/onboarding");
  }

  const caps = await getCapabilities(member.organizationId);
  const capsObject = Object.fromEntries(caps);
  const orgName = member.organization.tradeName ?? member.organization.legalName;

  const initials = getInitials(session.user.name, session.user.email);

  const allLocations = await prisma.location.findMany({
    where: { organizationId: member.organizationId, deletedAt: null },
    select: { id: true, name: true, type: true, city: true, state: true },
    orderBy: { createdAt: "asc" },
  });
  const scopedLocations =
    member.locationScopes.length > 0
      ? allLocations.filter((l) => member.locationScopes.includes(l.id))
      : allLocations;
  const onlyScopedLocation = scopedLocations.length === 1 ? scopedLocations[0] : null;
  const selectedLocation = await readSelectedLocation(
    scopedLocations.map((l) => l.id),
    onlyScopedLocation?.id ?? ALL_LOCATIONS,
  );

  return (
    <CapabilitiesProvider value={capsObject}>
      <div className="flex h-screen overflow-hidden bg-background">
        <NavSidebar orgName={orgName} role={member.role} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <AppTopbar
            userName={session.user.name ?? session.user.email}
            userEmail={session.user.email}
            userInitials={initials}
            organizationId={member.organizationId}
            locations={scopedLocations}
            selectedLocationId={selectedLocation}
          />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto h-full w-full max-w-[1680px] px-4 py-5 md:px-6 md:py-6 2xl:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </CapabilitiesProvider>
  );
}
