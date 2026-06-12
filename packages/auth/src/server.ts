import { prisma } from "@nohub/db";
import { getEnv } from "@nohub/shared/env";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink, organization, twoFactor } from "better-auth/plugins";
import { link, sendEmail } from "./mailer";

const env = getEnv();

// Origens confiáveis para CSRF/redirect. Em Vercel, a URL do request pode ser
// a do deployment (preview/branch) e não a BETTER_AUTH_URL — por isso incluímos
// as URLs injetadas pela Vercel e um wildcard para previews do projeto.
const trustedOrigins = Array.from(
  new Set(
    [
      env.BETTER_AUTH_URL,
      env.NEXT_PUBLIC_APP_URL,
      process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
      process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
      process.env.VERCEL_PROJECT_PRODUCTION_URL &&
        `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
      // previews: nohub-market-git-<branch>-<scope>.vercel.app e hashes
      "https://nohub-market-*.vercel.app",
    ].filter(Boolean) as string[],
  ),
);

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins,
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // RN-05 / decisão 13
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "NoHub Market — Redefinição de senha",
        html: link("Redefinir minha senha", url),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "NoHub Market — Confirme seu email",
        html: link("Confirmar email", url),
      });
    },
  },

  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined,

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  plugins: [
    organization({
      // limite de 5 organizações por usuário (RN-04)
      membershipLimit: 100,
      allowUserToCreateOrganization: true,
    }),
    twoFactor(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: "NoHub Market — Seu link de acesso",
          html: link("Entrar no NoHub Market", url),
        });
      },
    }),
  ],
});

export type Auth = typeof auth;
