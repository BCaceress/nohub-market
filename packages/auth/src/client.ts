import { magicLinkClient, organizationClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// No browser usa sempre a origin atual (same-origin com as rotas /api/auth),
// evitando CORS/host errado. No server (SSR) cai pra env var.
const browserOrigin = (globalThis as { location?: { origin?: string } }).location?.origin;

export const authClient = createAuthClient({
  baseURL: browserOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [organizationClient(), twoFactorClient(), magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession, organization, twoFactor } = authClient;
