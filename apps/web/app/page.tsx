import Image from "next/image";
import { redirect } from "next/navigation";
import logo from "../public/logo-horizontal-crema.png";
import playa from "../public/portada-playa-negra.jpg";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { appEnabled } from "@/lib/stage";

// Portada de bnbtico.com hasta el lanzamiento. En pruebas y local redirige a la app; `?pronto=1` la fuerza para verla.
// Revisión UX C1 (2026-10-27): tarjeta de la oferta bajo la foto, «Cómo funciona» en tres pasos y el botón de propietarios
// solo cuando hay número de WhatsApp de bnbtico (`WA_OWNERS` en Vercel); sin él, «Abrimos pronto en el Caribe sur.».
const OWNER_CTA_TEXT = "Hola, tengo una casa en el Caribe sur y quiero publicarla en bnbtico.";

function ownerCtaUrl(): string | null {
  const number = process.env.WA_OWNERS?.replace(/\D/g, "");
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(OWNER_CTA_TEXT)}` : null;
}
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
  const ownerCta = ownerCtaUrl();
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
      <section className="soon-offer" aria-labelledby="oferta">
        <h2 id="oferta">¿Tiene una casa en el Caribe?</h2>
        <p>
          <b>Las primeras 50 casas: 12 meses gratis.</b> Después, ₡9 900 al mes por casa, sin comisiones ni permanencia.
        </p>
        {ownerCta ? (
          <a className="soon-cta" href={ownerCta} rel="noopener">
            Quiero publicar mi casa gratis
          </a>
        ) : (
          <p className="soon-later">Abrimos pronto en el Caribe sur.</p>
        )}
      </section>
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
        <ol className="soon-steps">
          <li>
            <b>El propietario publica</b> su casa con fotos, precio en colones y su WhatsApp verificado. bnbtico la revisa antes de mostrarla.
          </li>
          <li>
            <b>Usted la encuentra</b> sin registrarse, guarda sus favoritas y le escribe con un mensaje ya redactado con fechas y personas.
          </li>
          <li>
            <b>Acuerdan directo</b> por WhatsApp, sin intermediarios ni comisiones. Nosotros solo los ponemos en contacto.
          </li>
        </ol>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
