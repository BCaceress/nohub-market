import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NoHub Market — O sistema que cresce com seu negócio",
  description:
    "Mercados autônomos, conveniências e vendas online em uma só plataforma. Configure em minutos, opere com confiança.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  manifest: "/manifest.webmanifest",
};

// Script inline para evitar flash de tema errado antes da hidratação
const themeScript = `(function(){try{var t=localStorage.getItem('nohub-theme');var d=document.documentElement;if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){d.classList.add('dark');}else{d.classList.remove('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: bootstrap theme before hydration */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <Toaster
          richColors
          position="top-center"
          toastOptions={{
            classNames: {
              toast:
                "!font-sans !rounded-xl !border !border-border !shadow-lg !bg-card !text-foreground",
              title: "!font-semibold !text-sm",
              description: "!text-muted-foreground !text-xs",
            },
          }}
        />
      </body>
    </html>
  );
}
