import Link from "next/link";
import { logoutAction, switchRoleAction } from "@/actions/account";
import { EditProfileForm, EntryForm } from "@/components/account-forms";
import { I } from "@/components/icons";
import { FlowHeader, RootHeader } from "@/components/shell";
import { Initials, ListItem } from "@/components/ui";
import { auth } from "@/lib/auth";
import { listOwnListings } from "@/lib/listings/repo";
import { STATUS_LABELS } from "@/lib/listings/schema";
import { formatPhone } from "@/lib/phone";
import { currentRole } from "@/lib/role";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Mi cuenta" };

/** Mi cuenta (cliente, pantalla 08) y Cuenta (propietario, pantalla 20). Sin sesión: Ingresar (06). */
export default async function Cuenta({ searchParams }: { searchParams: Promise<{ editar?: string; modo?: string }> }) {
  const params = await searchParams;
  const a = await auth();
  const [account, role] = await Promise.all([a.current(), currentRole()]);

  if (!account) {
    return (
      <>
        <FlowHeader title="Ingresar" back={role === "owner" ? "/propietario" : "/explorar"} />
        <EntryForm demo={a.demo} role={role} mode={params.modo === "entrar" ? "login" : "register"} />
      </>
    );
  }

  const owner = role === "owner";
  const editing = params.editar === "1";
  const db = owner ? await supabaseServer() : null;
  const listings = db ? await listOwnListings(db) : [];

  return (
    <>
      <RootHeader title={owner ? "Cuenta" : "Mi cuenta"} home={owner ? "/propietario" : "/explorar"} />

      <section className="card row" style={{ gap: 14 }}>
        <Initials name={account.name} />
        <div className="stack" style={{ gap: 3, flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 19 }}>{account.name}</h3>
          <span className="row small primary" style={{ gap: 6, fontWeight: 600, flexWrap: "wrap" }}>
            <I.check size={16} /> WhatsApp verificado · <span className="num">{formatPhone(account.phone)}</span>
          </span>
        </div>
        {editing ? <Link href="/cuenta" className="link small">Listo</Link> : <Link href="/cuenta?editar=1" className="link small">Editar</Link>}
      </section>

      {editing ? (
        <section className="card stack">
          <h3>Mi perfil</h3>
          <EditProfileForm account={account} demo={a.demo} />
        </section>
      ) : null}

      {owner ? (
        <section className="card stack">
          <div className="row between">
            <b>Suscripción</b>
            <span className="xs muted">Oferta de lanzamiento</span>
          </div>
          {listings.filter((l) => l.status !== "draft").length === 0 ? (
            <p className="small muted">Cuando publique una casa, aquí verá su suscripción. Las primeras 50 casas tienen 12 meses gratis.</p>
          ) : (
            <div className="stack" style={{ gap: 8, fontSize: 14 }}>
              {listings
                .filter((l) => l.status !== "draft")
                .map((l) => (
                  <div key={l.id} className="row between" style={{ gap: 8 }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</span>
                    <span className={`num ${l.status === "active" ? "primary" : "muted"}`} style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                      {l.status === "active" ? "Gratis 12 meses" : `${STATUS_LABELS[l.status].label} · ₡0`}
                    </span>
                  </div>
                ))}
            </div>
          )}
          <hr className="divider" />
          <div className="row between" style={{ alignItems: "baseline" }}>
            <span className="small muted">Próximo cobro</span>
            <b className="num">₡0 · sin método de pago</b>
          </div>
          <span className="xs muted">₡9 900 al mes por casa activa, sin permanencia. Sin comisiones por alquiler, nunca.</span>
        </section>
      ) : null}

      <section className="list">
        {!owner ? <ListItem href="/cuenta?editar=1" icon={<I.user />} title="Mi perfil" detail="Descripción y correo de recuperación (opcionales)" /> : null}
        {!owner ? <ListItem href="/favoritos" icon={<I.heart />} title="Favoritos" detail="Las casas que guarde" /> : null}
        <ListItem href="/ayuda" icon={<I.help />} title="Ayuda por WhatsApp" detail={owner ? "Línea de bnbtico para propietarios" : "Línea de bnbtico para clientes"} />
        {account.isAdmin ? <ListItem href="/admin" icon={<I.clipboard />} title="Revisión de anuncios · admin" detail="Cola de casas por revisar" /> : null}
        {owner ? (
          <ListItem onClickForm={switchRoleAction} icon={<I.search />} title="Buscar una casa" detail="Pasar al modo cliente" right={<RoleField role="guest" />} />
        ) : null}
      </section>

      {!owner ? (
        <section className="card-arena stack">
          <b className="display">¿Tiene una casa en el Caribe?</b>
          <span className="small">Publíquela gratis durante 12 meses si está entre las primeras 50. Sin comisiones: los clientes le escriben por WhatsApp.</span>
          <form action={switchRoleAction}>
            <input type="hidden" name="role" value="owner" />
            <button className="btn btn-ghost" type="submit">Publicar mi casa</button>
          </form>
        </section>
      ) : null}

      <div className="row between" style={{ padding: "0 4px" }}>
        <form action={logoutAction}>
          <button className="btn-link muted" type="submit">Cerrar sesión</button>
        </form>
        <span className="xs muted">Términos y privacidad</span>
      </div>
      {a.demo ? <p className="xs muted">Entorno de pruebas: perfil y sesión se guardan solo en este navegador.</p> : null}
    </>
  );
}

/** Campo oculto para la fila «Buscar una casa» (el formulario lo envuelve ListItem). */
function RoleField({ role }: { role: "guest" | "owner" }) {
  return (
    <>
      <input type="hidden" name="role" value={role} />
      <span className="chev"><I.chevron /></span>
    </>
  );
}
