import { FlowHeader } from "../chrome";
import { useListingsCount } from "../own-listings-query";
import { SUPPORT, waLink } from "../support";
import { Button, ButtonLink, WaIcon } from "../../shared/button";
import { Field, TextInput } from "../../shared/field";
import { RouterButtonLink } from "../router-buttons";

// ---------- /cuenta/recuperar ----------
export function RecuperarScreen() {
  return (
    <>
      <FlowHeader title="Recuperar mi cuenta" back="/cuenta" historyBack />
      <section className="card stack gap-14">
        <p>Use el correo que añadió y confirmó en su perfil. Después podrá verificar su nuevo WhatsApp para recuperar el acceso.</p>
        <Field id="recovery-email" label="Correo confirmado">
          {(control) => <TextInput {...control} type="email" placeholder="nombre@ejemplo.com" disabled />}
        </Field>
        <Button variant="primary" size="lg" disabled>
          Recuperar con mi correo
        </Button>
        <p className="xs muted">La recuperación por correo se activa cuando confirme uno en su perfil.</p>
      </section>
      <section className="card stack">
        <h3>¿No tiene un correo confirmado?</h3>
        <p className="small">Pida ayuda a 3bstays para revisar la recuperación. Indicar su nombre y otro número no basta para recuperar una cuenta. No mande documentos ni códigos por este formulario.</p>
        <RouterButtonLink to="/ayuda" variant="secondary" size="xl" block icon={<WaIcon />}>
          Escribir a 3bstays por WhatsApp
        </RouterButtonLink>
      </section>
    </>
  );
}

// ---------- /ayuda ----------
export function AyudaScreen() {
  const s = SUPPORT[(useListingsCount().count ?? 0) > 0 ? "owner" : "guest"];
  return (
    <>
      <FlowHeader title="Ayuda por WhatsApp" back="/cuenta" historyBack />
      <section className="card stack gap-14">
        <span className="eyebrow">{s.label}</span>
        <p>{s.intro}</p>
        {s.number ? (
          <>
            <p className="small muted">
              <span className="num">{s.number}</span> · canal separado del de {s.other}.
            </p>
            <ButtonLink variant="secondary" size="xl" block icon={<WaIcon />} href={waLink(s.number, s.greeting)} target="_blank" rel="noopener">
              Abrir WhatsApp
            </ButtonLink>
          </>
        ) : (
          <>
            <p className="small muted">Número pendiente de configurar. Canal separado del de {s.other}.</p>
            <Button variant="secondary" size="xl" block icon={<WaIcon />} disabled>
              Abrir WhatsApp
            </Button>
          </>
        )}
      </section>
    </>
  );
}
