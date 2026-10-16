import Link from "next/link";
import { redirect } from "next/navigation";
import { ScreenTitle } from "@/components/shell";
import { auth } from "@/lib/auth";

export const metadata = { title: "Tu cuenta está lista" };

export default async function Lista({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const account = await (await auth()).current();
  if (!account) redirect("/cuenta");
  const { next } = await searchParams;
  const continueTo = next && next.startsWith("/") ? next : "/explorar";
  return (
    <>
      <ScreenTitle title="Tu cuenta está lista" />
      <section className="card stack">
        <h3>Protegé el acceso a tu cuenta</h3>
        <p>Tu WhatsApp ya está verificado. Añadí un correo para recuperar tu cuenta si perdés acceso a ese número.</p>
        <p className="small">Es opcional. Podés añadirlo y confirmarlo después en Mi cuenta.</p>
        <Link href="/cuenta?editar=1" className="btn btn-primary">Añadir correo a mi perfil</Link>
        <Link href={continueTo} className="btn btn-ghost">Ahora no · continuar</Link>
      </section>
    </>
  );
}
