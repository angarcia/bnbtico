import Link from "next/link";
import { ScreenTitle } from "./shell";

export function Placeholder({ title, phase, text }: { title: string; phase: number; text: string }) {
  return (
    <>
      <ScreenTitle title={title} />
      <section className="card stack">
        <span className="eyebrow">Fase {phase} del plan</span>
        <p>{text}</p>
        <p className="small muted">Esta pantalla se construye en la fase {phase}. Mientras tanto, ya podés crear tu cuenta con tu WhatsApp.</p>
        <Link href="/cuenta" className="btn btn-primary">Ir a Mi cuenta</Link>
      </section>
    </>
  );
}
