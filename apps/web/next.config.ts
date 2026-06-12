import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Raiz do monorepo (apps/web -> ../../).
const monorepoRoot = path.join(__dirname, "..", "..");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@nohub/auth", "@nohub/db", "@nohub/shared"],
  // Prisma client (+ Neon adapter) precisa ser resolvido do node_modules em
  // runtime para que o query_compiler_bg.wasm fique ao lado dele.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-neon", "@neondatabase/serverless"],
  // Monorepo pnpm: o nft não traça o .wasm do .prisma/client aninhado no
  // store. Forçamos a inclusão nas funções serverless.
  outputFileTracingRoot: monorepoRoot,
  // Globs resolvidos relativos ao dir do app (apps/web) — subir 2 níveis até
  // a raiz onde o pnpm store guarda o .prisma/client com o .wasm.
  // Chave "/**" cobre TODAS as funções (rotas /api E server components como
  // /app), não só /api — senão o wasm não é incluído na função do dashboard
  // e o Prisma falha ao inicializar ("Invalid prisma.X invocation").
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/*",
      "../../node_modules/.prisma/client/*",
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
