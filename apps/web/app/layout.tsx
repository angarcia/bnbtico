import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "bnbtico", template: "%s · bnbtico" },
  description: "Casas en alquiler en el Caribe de Costa Rica. Hablás directo con el propietario por WhatsApp.",
  applicationName: "bnbtico",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "bnbtico", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5EF" },
    { media: "(prefers-color-scheme: dark)", color: "#141917" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CR">
      <body>{children}</body>
    </html>
  );
}
