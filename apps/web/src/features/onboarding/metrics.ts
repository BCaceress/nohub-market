"use server";

import { writeAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth-server";

// Funil de onboarding: início/passo/conclusão. Abandono é derivável de
// Organization.onboardingStep < 6 && !onboardingCompleted.
export async function trackOnboardingEvent(
  event: "started" | "step_completed" | "abandoned",
  meta?: { step?: number; organizationId?: string },
) {
  const session = await getSession();
  if (!session) return;
  await writeAudit({
    organizationId: meta?.organizationId ?? null,
    actorId: session.user.id,
    action: `onboarding.${event}`,
    resourceType: "Onboarding",
    metadata: meta?.step ? { step: meta.step } : undefined,
  });
}
