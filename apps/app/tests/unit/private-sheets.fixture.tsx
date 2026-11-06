import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConfirmSheet } from "../../src/client/confirm-sheet";
import { CloseSheet } from "../../src/client/close-sheet";
import { MarkSheet } from "../../src/client/mark-sheet";
import { HousePicker } from "../../src/client/house-picker";
import "../../src/styles/global.css";

function Fixture() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const target = useRef<HTMLHeadingElement>(null);
  const params = new URLSearchParams(location.search);
  const kind = params.get("kind");
  const close = () => setOpen(false);
  const confirm = (value: string) => {
    setResult(value);
    close();
  };
  if (kind === "picker") return (
    <main className="view">
      <h1>Consultas</h1>
      <HousePicker houses={Array.from({ length: 14 }, (_, n) => ({ id: `house-${n}`, name: n === 13 ? "Casa Manzanillo frente al mar con jardín y acceso al parque nacional" : `Casa del Caribe ${n + 1}` }))}
        currentId={picked} allowAll onPick={setPicked} />
      <output>{picked ?? "Todas"}</output>
    </main>
  );
  return (
    <main>
      <h1>Calendario de prueba</h1>
      <h2 ref={target} tabIndex={-1}>Destino de retorno</h2>
      <button onClick={() => setOpen(true)}>Abrir hoja</button>
      <output>{result}</output>
      {open && kind === "confirm" && (
        <ConfirmSheet title="¿Cerrar sesión?" body="Tendrá que volver a ingresar." confirmLabel="Cerrar sesión"
          confirmClassName="btn btn-primary btn-lg" cancelClassName="btn btn-ghost btn-lg"
          onClose={close} onConfirm={() => confirm("Confirmado")}
          returnFocus={params.has("return") ? target : undefined} />
      )}
      {open && kind === "close" && <CloseSheet onClose={close} onConfirm={(date) => confirm(date ?? "Sin fecha")} />}
      {open && kind === "mark" && <MarkSheet today="2026-11-04" onClose={close} onConfirm={(days) => confirm(days.join(","))} />}
    </main>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<Fixture />);
Object.assign(window, { unmountSheetFixture: () => root.unmount() });
