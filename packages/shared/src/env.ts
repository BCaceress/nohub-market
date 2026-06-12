import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("NoHub Market <noreply@example.com>"),
  BRASILAPI_URL: z.string().url().default("https://brasilapi.com.br/api"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("NoHub Market"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // Durante o build (next build / coleta de page data) as vars de runtime
    // podem não estar presentes — não derrubar o build por isso. Em runtime
    // (sem essa fase) a validação continua estrita.
    if (process.env.NEXT_PHASE === "phase-production-build") {
      console.warn(
        "⚠️ Env incompleto durante o build (ok se existir em runtime):",
        Object.keys(fieldErrors),
      );
      return process.env as unknown as Env;
    }
    console.error("❌ Variáveis de ambiente inválidas:", fieldErrors);
    throw new Error("Configuração de ambiente inválida. Veja .env.example.");
  }
  cached = parsed.data;
  return cached;
}
