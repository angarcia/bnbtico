import { lazy, Suspense, useState } from "react";
import { I } from "../shared/icons";
import { authApi } from "./session";
import { SignInForm } from "./sign-in";
import { IconButton } from "../shared/button";
import { Dialog } from "../shared/overlay";

const DialogCodeForm = lazy(() => import("./screens/cuenta-codigo").then((m) => ({ default: m.DialogCodeForm })));

export function WhatsAppDialog({ mode, next, onClose }: { mode: "account" | "publish"; next?: string; onClose: () => void }) {
  const [codeSent, setCodeSent] = useState(false);
  const [namePhone, setNamePhone] = useState<string | null>(null);
  // Ventana normal de escritorio; no se cierra con el fondo: se perdería el código a medias (inventario de superficies, 1).
  return (
    <Dialog layout="sign-in" label={mode === "publish" ? "Verificar WhatsApp" : "Ingresar"} closeButton dismissible={{ backdrop: false }} onClose={onClose}
      headerStart={codeSent || namePhone ? (
        <IconButton label="Volver al número" onClick={async () => {
          if (codeSent) (await authApi()).cancel();
          setNamePhone(null);
          setCodeSent(false);
        }}><I.back size={20} /></IconButton>
      ) : null}>
      <Suspense fallback={<p role="status">Cargando…</p>}>
        {codeSent ? (
          <DialogCodeForm next={next} onDone={onClose} />
        ) : (
          <SignInForm next={next} mode={mode} nameStep={{ phone: namePhone, setPhone: setNamePhone }} onCodeSent={() => setCodeSent(true)} />
        )}
      </Suspense>
    </Dialog>
  );
}
