import type { Metadata, Viewport } from "next";
import { Figtree, Outfit } from "next/font/google";
import { Analytics } from "@/components/analytics";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/seo";
import "./globals.css";

// Tipografías del sistema «Sol y sal» (design/tokens/tokens.json 0.2.0): Outfit para títulos y cifras, Figtree para el resto.
const display = Outfit({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--display", display: "swap" });
const body = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--body", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · bnbtico" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_CR",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "bnbtico · Playa Negra, Puerto Viejo de Talamanca" }],
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: ["/og.jpg"] },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "bnbtico", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFBF2" },
    { media: "(prefers-color-scheme: dark)", color: "#141917" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
      <Analytics />
    </html>
  );
}
