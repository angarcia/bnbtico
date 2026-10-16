import Script from "next/script";
import { GA_ID } from "@/lib/analytics";

/** Google tag (gtag.js), igual que el fragmento oficial, cargado tras la primera pintura en todas las páginas. */
export function Analytics() {
  if (!GA_ID) return null;
  return (
    <>
      <Script id="ga-src" src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${GA_ID}');
      `}</Script>
    </>
  );
}
