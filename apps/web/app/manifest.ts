import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "bnbtico",
    short_name: "bnbtico",
    description: "Casas en alquiler en el Caribe de Costa Rica, contacto directo por WhatsApp.",
    start_url: "/",
    display: "standalone",
    lang: "es-CR",
    background_color: "#FFFBF2",
    theme_color: "#FFFBF2",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
