import Link from "next/link";
import { redirect } from "next/navigation";
import { I } from "@/components/icons";
import { FlowHeader } from "@/components/shell";
import { auth } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

export const metadata = { title: "Su cuenta está lista" };

export default async function Lista({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const account = await (await auth()).current();
  if (!account) redirect("/cuenta");
  const { next } = await searchParams;
  const continueTo = safeNext(next) ?? "/explorar";
  return (
    <>
      <FlowHeader title="Ingresar" back="/explorar" />
      <div className="stack" style={{ gap: 22, padding: "8px 4px 0" }}>
        <div className="stack" style={{ gap: 8 }}>
          <span className="avatar" style={{ background: "var(--primary)", color: "var(--primary-on)" }}><I.check size={26} /></span>
          <h2 style={{ fontSize: 32, lineHeight: 1.05 }}>¡Listo! Su cuenta está creada</h2>
          <p className="muted">Su WhatsApp ya está verificado. Si quiere, añada un correo para recuperar la cuenta si pierde el acceso a ese número. Puede añadirlo después en Mi cuenta.</p>
        </div>
        <Link href="/cuenta?editar=1" className="btn btn-primary btn-xl">Añadir correo a mi perfil</Link>
        <Link href={continueTo} className="btn btn-ghost btn-lg">Ahora no · continuar</Link>
      </div>
    </>
  );
}
