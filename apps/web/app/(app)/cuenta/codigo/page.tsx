import { redirect } from "next/navigation";
import { cancelCodeAction } from "@/actions/account";
import { CodeForm, DemoNote } from "@/components/account-forms";
import { FlowHeader } from "@/components/shell";
import { auth } from "@/lib/auth";
import { resendWaitSeconds } from "@/lib/auth/cooldown";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Introduzca el código" };

export default async function Codigo({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const a = await auth();
  const pending = await a.pending();
  if (!pending) redirect("/cuenta");
  const { next } = await searchParams;
  return (
    <>
      <FlowHeader title="Ingresar" back="/cuenta" />
      <CodeForm phone={formatPhone(pending.phone)} demo={a.demo} next={next} waitSeconds={resendWaitSeconds(pending.sentAt)} />
      <form action={cancelCodeAction} style={{ padding: "0 4px" }}>
        <button className="btn-link" type="submit">Cambiar número</button>
      </form>
      <DemoNote demo={a.demo} />
    </>
  );
}
