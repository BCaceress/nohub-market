import { magicLinkClient, organizationClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [organizationClient(), twoFactorClient(), magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession, organization, twoFactor } = authClient;
