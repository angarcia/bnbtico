import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { I } from "../shared/icons";
import { authApi } from "./session";
import { SignInForm } from "./sign-in";
import { IconButton } from "../shared/button";

const DialogCodeForm = lazy(() => import("./screens/cuenta-codigo").then((m) => ({ default: m.DialogCodeForm })));

export function WhatsAppDialog({ mode, next, onClose }: { mode: "account" | "publish"; next?: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [namePhone, setNamePhone] = useState<string | null>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} className="whatsapp-dialog" aria-label={mode === "publish" ? "Verificar WhatsApp" : "Ingresar"} onCancel={(event) => {
      event.preventDefault();
      onClose();
    }}>
      <div className="row">
        {codeSent || namePhone ? (
          <IconButton label="Volver al número" onClick={async () => {
            if (codeSent) (await authApi()).cancel();
            setNamePhone(null);
            setCodeSent(false);
          }}><I.back size={20} /></IconButton>
        ) : null}
        <IconButton label="Cerrar" onClick={onClose}><I.x size={20} /></IconButton>
      </div>
      <Suspense fallback={<p role="status">Cargando…</p>}>
        {codeSent ? (
          <DialogCodeForm next={next} onDone={onClose} />
        ) : (
          <SignInForm next={next} mode={mode} nameStep={{ phone: namePhone, setPhone: setNamePhone }} onCodeSent={() => setCodeSent(true)} />
        )}
      </Suspense>
    </dialog>
  );
}
