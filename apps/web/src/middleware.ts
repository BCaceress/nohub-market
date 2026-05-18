import { type NextRequest, NextResponse } from "next/server";

// Middleware LEVE (decisão 12): NÃO importar Better Auth/Prisma aqui.
// Checa apenas a presença do cookie de sessão na borda; a verificação
// fina (org ativa, role) acontece no servidor.
const SESSION_COOKIE = "better-auth.session_token";

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);
  const { pathname } = req.nextUrl;

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*"],
};
