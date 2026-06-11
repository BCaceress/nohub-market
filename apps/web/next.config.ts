import path from "node:path";
import type { NextConfig } from "next";

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
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**",
      "./node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client/query_engine_bg.wasm",
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
