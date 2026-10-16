import { redirect } from "next/navigation";
import { cancelCodeAction } from "@/actions/account";
import { CodeForm, DemoNote } from "@/components/account-forms";
import { ScreenTitle } from "@/components/shell";
import { auth } from "@/lib/auth";
import { resendWaitSeconds } from "@/lib/auth/cooldown";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Verificá tu WhatsApp" };

export default async function Codigo({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const a = await auth();
  const pending = await a.pending();
  if (!pending) redirect("/cuenta");
  const { next } = await searchParams;
  const waitSeconds = resendWaitSeconds(pending.sentAt);
  return (
    <>
      <ScreenTitle title="Verificá tu WhatsApp" />
      <CodeForm phone={formatPhone(pending.phone)} demo={a.demo} next={next} waitSeconds={waitSeconds} />
      <form action={cancelCodeAction} className="center">
        <button className="btn-link" type="submit">Cambiar número o volver</button>
      </form>
      <DemoNote demo={a.demo} />
    </>
  );
}
