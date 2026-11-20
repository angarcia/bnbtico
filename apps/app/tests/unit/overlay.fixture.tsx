// Banco de pruebas de shared/overlay.tsx (overlay.test.ts): una hoja con un campo, otra apilada encima, una ventana y el aviso.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Dialog, Sheet } from "../../src/shared/overlay";
import { toast } from "../../src/shared/toast";
import "../../src/styles/global.css";

function Fixture() {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const kind = new URLSearchParams(location.search).get("kind");
  const Container = kind === "dialog" ? Dialog : Sheet;
  const close = (reason: string) => {
    setLog((l) => [...l, `cerrada:${reason}`]);
    setOpen(false);
    setText("");
  };
  return (
    <main>
      <h1>Pantalla de prueba</h1>
      <button onClick={() => setOpen(true)}>Abrir hoja</button>
      <output>{log.join(" ")}</output>
      {open ? (
        <Container title="Hoja de prueba" busy={busy} onClose={close} confirmDiscard={() => text !== ""}>
          <label>
            Nota
            <input value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <button onClick={() => setInner(true)}>Abrir otra</button>
          <button onClick={() => toast("Aviso de prueba")}>Avisar</button>
          <button onClick={() => setBusy((b) => !b)}>{busy ? "Libre" : "Ocupada"}</button>
          {inner ? (
            <Sheet title="Hoja de encima" onClose={() => setInner(false)}>
              <button onClick={() => setInner(false)}>Cerrar la de encima</button>
            </Sheet>
          ) : null}
        </Container>
      ) : null}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
