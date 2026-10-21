import Link from "next/link";
import { RootHeader } from "./shell";

/** Pantalla de una fase posterior: cabecera raíz del diseño y una tarjeta que dice cuándo llega. */
export function Placeholder({ title, phase, text, home }: { title: string; phase: number; text: string; home?: string }) {
  return (
    <>
      <RootHeader title={title} home={home} />
      <section className="card stack">
        <span className="eyebrow">Fase {phase} del plan</span>
        <p>{text}</p>
        <p className="small muted">Esta pantalla se construye en la fase {phase}. Mientras tanto, ya puede crear su cuenta con su WhatsApp.</p>
        <Link href="/cuenta" className="btn btn-ghost">Ir a Mi cuenta</Link>
      </section>
    </>
  );
}
