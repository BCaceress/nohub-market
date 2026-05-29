import { prisma } from "@nohub/db";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/features/onboarding/wizard";
import { getSession } from "@/lib/auth-server";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/signin?redirect=/onboarding");
  if (!session.user.emailVerified)
    redirect(`/verify-email?email=${encodeURIComponent(session.user.email)}`);

  // Se já há org com onboarding completo, vai para o app.
  const member = await prisma.member.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "desc" },
  });
  if (member?.organization.onboardingCompleted) redirect("/app");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <OnboardingWizard initialStep={member?.organization.onboardingStep ?? 1} />
    </main>
  );
}
