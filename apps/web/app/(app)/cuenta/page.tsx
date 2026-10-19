import Link from "next/link";
import { logoutAction, switchRoleAction } from "@/actions/account";
import { EditProfileForm, EntryForm } from "@/components/account-forms";
import { I } from "@/components/icons";
import { ScreenTitle } from "@/components/shell";
import { auth } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { currentRole } from "@/lib/role";

export const metadata = { title: "Mi cuenta" };

export default async function Cuenta({ searchParams }: { searchParams: Promise<{ editar?: string; modo?: string }> }) {
  const params = await searchParams;
  const a = await auth();
  const [account, role] = await Promise.all([a.current(), currentRole()]);

  if (!account) return <EntryForm demo={a.demo} role={role} mode={params.modo === "entrar" ? "login" : "register"} />;

  const editing = params.editar === "1";
  return (
    <>
      <ScreenTitle title={role === "owner" ? "Cuenta" : "Mi cuenta"} />
      <section className="card stack">
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0 }}>{account.name}</h3>
            <span className="small muted">{formatPhone(account.phone)}</span>
          </div>
        </div>
        <p className="small"><span className="badge badge-ok">✓ WhatsApp verificado</span></p>
        <p className="small">
          Tu WhatsApp verificado es lo único necesario para {role === "owner" ? "publicar y recibir consultas" : "escribirle a un propietario"}. Los propietarios y clientes ven este sello junto a tu nombre.
        </p>
      </section>

      {account.isAdmin ? <Link href="/admin" className="btn btn-ghost">Revisión de anuncios · admin</Link> : null}
      <Link href="/ayuda" className="btn btn-wa"><I.wa size={20} /> Escribile a bnbtico por WhatsApp</Link>

      <form action={switchRoleAction}>
        <input type="hidden" name="role" value={role === "owner" ? "guest" : "owner"} />
        <button className="btn btn-ghost" style={{ width: "100%" }} type="submit">
          {role === "owner" ? "Buscar una casa · modo cliente" : "¿Tenés una casa? Publicala"}
        </button>
      </form>

      {editing ? (
        <section className="card stack">
          <div className="row between">
            <h3>Editar perfil</h3>
            <Link href="/cuenta" className="chip">Listo</Link>
          </div>
          <EditProfileForm account={account} demo={a.demo} />
          <hr />
          <p className="xs muted">Sesión recordada en este navegador. En otro dispositivo necesitarás un código por WhatsApp.</p>
        </section>
      ) : (
        <Link href="/cuenta?editar=1" className="btn btn-ghost">Editar perfil</Link>
      )}

      <form action={logoutAction} className="center">
        <button className="btn-link" type="submit">Cerrar sesión</button>
      </form>
      {a.demo ? <p className="xs muted">Entorno de pruebas: perfil y sesión se guardan solo en este navegador.</p> : null}
    </>
  );
}
