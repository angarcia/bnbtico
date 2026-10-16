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
          Una nueva forma de descubrir y alquilar alojamientos en Costa Rica. Más cerca de lo local.
        </p>
      </div>
    </main>
  );
}
