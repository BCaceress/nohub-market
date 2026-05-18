"use server";

import { prisma } from "@nohub/db";

const CONSENT_VERSION = "2026-05-17";

// LGPD (RN-09): registra data e versão do aceite de Termos + Privacidade.
export async function recordConsent(email: string) {
  await prisma.user.update({
    where: { email },
    data: { consentedAt: new Date(), consentVersion: CONSENT_VERSION },
  });
}
