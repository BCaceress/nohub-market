import { prisma } from "@nohub/db";
import { getEnv } from "@nohub/shared/env";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink, organization, twoFactor } from "better-auth/plugins";
import { link, sendEmail } from "./mailer";

const env = getEnv();

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
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
