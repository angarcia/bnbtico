import Image from "next/image";
import { redirect } from "next/navigation";
import logo from "../public/logo-horizontal-terracota.png";
import playa from "../public/portada-playa-negra.jpg";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { appEnabled } from "@/lib/stage";

// Portada de bnbtico.com hasta el lanzamiento. En pruebas y local redirige a la app; `?pronto=1` la fuerza para verla.
export default async function Portada({ searchParams }: { searchParams: Promise<{ pronto?: string }> }) {
  const { pronto } = await searchParams;
  if (appEnabled() && !pronto) redirect("/explorar");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE_URL}/#org`, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/icon-512.png`, areaServed: "Costa Rica" },
      { "@type": "WebSite", "@id": `${SITE_URL}/#web`, name: SITE_NAME, url: SITE_URL, description: SITE_DESCRIPTION, inLanguage: "es-CR", publisher: { "@id": `${SITE_URL}/#org` } },
    ],
  };
  return (
    <>
      <main className="soon">
        <div className="soon-bg">
          <Image src={playa} alt="Playa Negra, en Puerto Viejo de Talamanca, Limón: arena oscura, mar Caribe y selva hasta la orilla" fill priority sizes="100vw" placeholder="blur" />
          <div className="soon-shade" aria-hidden="true" />
        </div>
        <div className="soon-card">
          <Image className="soon-logo" src={logo} alt="bnbtico" priority />
          <span className="soon-eyebrow">Muy pronto</span>
          <h1 className="soon-title">Alquile en el Caribe de Costa Rica, directo con quien lo recibe</h1>
          <p className="soon-text">{SITE_DESCRIPTION}</p>
          <p className="soon-place">Playa Negra · Puerto Viejo de Talamanca</p>
        </div>
      </main>
      <section className="soon-more" aria-labelledby="que-es">
        <h2 id="que-es">Qué es bnbtico</h2>
        <p>
          Un catálogo de casas, apartamentos y habitaciones en alquiler en Costa Rica, publicados por quienes los alquilan. Usted ve la casa, el precio por noche o por mes y le escribe al propietario por WhatsApp. Sin intermediarios, sin comisiones por reserva.
        </p>
        <h2>Dónde empezamos</h2>
        <p>
          En el Caribe sur de Limón: Puerto Viejo de Talamanca, Playa Negra, Cocles, Playa Chiquita, Punta Uva, Manzanillo y Cahuita. Casas frente al mar, en la selva o en el pueblo, para un fin de semana, unas vacaciones o una temporada completa.
        </p>
        <h2>Cómo funciona</h2>
        <p>
          Quien tiene una casa la publica con sus fotos, su precio en colones y su WhatsApp verificado; bnbtico la revisa antes de mostrarla. Quien busca, explora sin registrarse, guarda favoritos y contacta directo con un mensaje ya redactado con fechas y personas. El acuerdo es entre las dos personas; nosotros solo las ponemos en contacto.
        </p>
        <p className="small muted">¿Tiene una casa en el Caribe? Las primeras 50 casas publicadas tendrán 12 meses gratis.</p>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
