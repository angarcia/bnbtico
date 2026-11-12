// Cola de subida del paso 7 (sin React ni canvas: lo inyecta la pantalla). Por cada foto elegida: preparar las tres
// variantes (de una en una, para no tener varias fotos de 12 MP decodificadas a la vez), subirlas (el adaptador limita a
// tres objetos a la vez entre todas) y registrarlas con la RPC en el orden en que se eligieron. Al registrar, relee la
// casa del servidor; la foto sale de la cola cuando ya está en la lista del servidor. Vive fuera de la pantalla: si el
// propietario sigue al paso 8, la subida termina igual.
import type { PhotoVariants } from "../../domain/api";
import { createLimiter } from "../../domain/concurrency";
import { DomainError } from "../../domain/errors";
import { MAX_PHOTOS_MESSAGE, UNSUPPORTED_MESSAGE, acceptsImage } from "../../domain/image";

export type UploadPhase = "preparing" | "uploading" | "saving";

export interface UploadItem {
  key: number;
  name: string;
  phase: UploadPhase;
  /** Objetos subidos (0–3). */
  uploaded: number;
}

export interface UploadDeps {
  /** Las tres variantes JPEG; falla si el navegador no puede decodificar la foto. */
  prepare(file: File): Promise<PhotoVariants>;
  upload(variants: PhotoVariants, onUploaded: () => void): Promise<string>;
  add(folder: string): Promise<unknown>;
  discard(folder: string): Promise<void>;
  /** Relee la casa del servidor (la lista de fotos manda; aquí no se copia nada). */
  refresh(): Promise<void>;
}

/** Pasos de la barra de progreso de una foto: preparar, tres objetos, registrar. */
export const UPLOAD_STEPS = 5;
export const progressOf = (i: Pick<UploadItem, "phase" | "uploaded">) => (i.phase === "preparing" ? 0 : i.phase === "uploading" ? 1 + i.uploaded : 4);

const FAILED = "No pudimos subir esa foto. Intente de nuevo.";

export function createUploadQueue() {
  let items: UploadItem[] = [];
  let notices: string[] = [];
  let seq = 0;
  let chain: Promise<unknown> = Promise.resolve();
  const prepareOne = createLimiter(1);
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const patch = (key: number, p: Partial<UploadItem>) => {
    items = items.map((i) => (i.key === key ? { ...i, ...p } : i));
    emit();
  };
  const drop = (key: number) => {
    items = items.filter((i) => i.key !== key);
    emit();
  };
  const notice = (message: string) => {
    if (!notices.includes(message)) notices = [...notices, message];
    emit();
  };

  async function run(file: File, key: number, deps: UploadDeps) {
    let variants: PhotoVariants;
    try {
      variants = await prepareOne(() => deps.prepare(file));
    } catch {
      notice(UNSUPPORTED_MESSAGE);
      return drop(key);
    }
    patch(key, { phase: "uploading" });
    let uploaded = 0;
    const folder = deps.upload(variants, () => patch(key, { uploaded: ++uploaded }));
    folder.catch(() => {}); // se espera en la cadena de abajo
    let reread: Promise<void> = Promise.resolve();
    // Registro en el orden de selección: espera a que se registre la anterior.
    const registered = chain.then(async () => {
      let path: string;
      try {
        path = await folder;
      } catch (e) {
        notice(e instanceof DomainError ? e.message : FAILED);
        return drop(key);
      }
      patch(key, { phase: "saving" });
      try {
        await deps.add(path);
      } catch (e) {
        await deps.discard(path).catch(() => {});
        notice(e instanceof DomainError ? e.message : FAILED);
        return drop(key);
      }
      // Fuera de la cadena: la siguiente foto no espera a la relectura.
      reread = deps
        .refresh()
        .catch(() => {})
        .finally(() => drop(key));
    });
    chain = registered;
    await registered;
    await reread;
  }

  return {
    subscribe(l: () => void) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    items: () => items,
    notices: () => notices,
    inFlight: () => items.length,
    clearNotices() {
      notices = [];
      emit();
    },
    /** Empieza a subir; `freeSlots` = cuántas fotos caben todavía (15 − servidor − en curso). */
    async start(files: File[], freeSlots: number, deps: UploadDeps) {
      notices = [];
      const accepted = files.filter(acceptsImage);
      if (accepted.length < files.length) notice(UNSUPPORTED_MESSAGE);
      if (accepted.length > freeSlots) notice(MAX_PHOTOS_MESSAGE);
      const batch = accepted.slice(0, Math.max(0, freeSlots)).map((file) => ({ file, key: ++seq }));
      items = [...items, ...batch.map(({ file, key }) => ({ key, name: file.name, phase: "preparing" as const, uploaded: 0 }))];
      emit();
      await Promise.all(batch.map(({ file, key }) => run(file, key, deps)));
    },
  };
}

export type UploadQueue = ReturnType<typeof createUploadQueue>;
