import Image from "next/image";
import logo from "../public/bnbtico-original.png";

export default function MuyPronto() {
  return (
    <main className="soon">
      <div className="soon-card">
        <div className="soon-logo" aria-hidden="true">
          <Image src={logo} alt="" priority />
        </div>
        <h1 style={{ fontSize: 28 }}>Muy pronto</h1>
        <p className="muted">
          Casas en alquiler en el Caribe de Costa Rica. Hablás directo con el propietario por WhatsApp, sin comisiones.
        </p>
      </div>
    </main>
  );
}
