import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "bnbtico",
    short_name: "bnbtico",
    description: "Casas en alquiler en el Caribe de Costa Rica, contacto directo por WhatsApp.",
    start_url: "/",
    display: "standalone",
    lang: "es-CR",
    background_color: "#F7F5EF",
    theme_color: "#D92349",
    icons: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
  };
}
