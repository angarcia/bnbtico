import { describe, expect, it } from "vitest";
import { createUploadQueue, progressOf, UPLOAD_STEPS, type UploadDeps } from "../../src/client/publish/photo-queue";
import { MAX_PHOTOS_MESSAGE, UNSUPPORTED_MESSAGE } from "../../src/domain/image";
import { DomainError } from "../../src/domain/errors";

const file = (name: string, type = "image/jpeg") => new File([new Uint8Array([1])], name, { type });
const blob = new Blob([new Uint8Array([1])], { type: "image/jpeg" });
const variants = { 480: blob, 800: blob, 1600: blob };

function deps(over: Partial<UploadDeps> = {}) {
  const log: string[] = [];
  const d: UploadDeps = {
    async prepare(f) {
      log.push(`prepare ${f.name}`);
      return variants;
    },
    async upload(_v, onUploaded) {
      for (let i = 0; i < 3; i++) onUploaded();
      return `casa/${log.filter((l) => l.startsWith("upload")).length}`;
    },
    async add(folder) {
      log.push(`add ${folder}`);
    },
    async discard(folder) {
      log.push(`discard ${folder}`);
    },
    async refresh() {
      log.push("refresh");
    },
    ...over,
  };
  return { d, log };
}

describe("cola de subida de fotos", () => {
  it("prepara, sube y registra cada foto en el orden elegido, y relee del servidor", async () => {
    const q = createUploadQueue();
    const { d, log } = deps({
      upload: async (_v, onUploaded) => {
        [0, 1, 2].forEach(() => onUploaded());
        return `casa/${Math.random()}`;
      },
    });
    let order: string[] = [];
    d.add = async (folder) => void (order = [...order, folder]);
    const states: string[][] = [];
    q.subscribe(() => states.push(q.items().map((i) => i.phase)));
    await q.start([file("a.jpg"), file("b.png", "image/png")], 15, d);
    expect(log.filter((l) => l.startsWith("prepare"))).toEqual(["prepare a.jpg", "prepare b.png"]);
    expect(order).toHaveLength(2);
    expect(log.filter((l) => l === "refresh").length).toBeGreaterThanOrEqual(1);
    expect(q.items()).toEqual([]);
    expect(states.flat()).toEqual(expect.arrayContaining(["preparing", "uploading", "saving"]));
  });

  it("el registro respeta el orden de selección aunque una subida termine antes", async () => {
    const q = createUploadQueue();
    const added: string[] = [];
    let n = 0;
    const { d } = deps({
      upload: async () => {
        const mine = n++;
        await new Promise((r) => setTimeout(r, mine === 0 ? 20 : 0));
        return `casa/${mine}`;
      },
      add: async (folder) => void added.push(folder),
    });
    await q.start([file("a.jpg"), file("b.jpg"), file("c.jpg")], 15, d);
    expect(added).toEqual(["casa/0", "casa/1", "casa/2"]);
  });

  it("rechaza HEIC con el mensaje de siempre y sigue con las demás", async () => {
    const q = createUploadQueue();
    const { d, log } = deps();
    await q.start([file("iphone.heic", "image/heic"), file("a.jpg")], 15, d);
    expect(q.notices()).toEqual([UNSUPPORTED_MESSAGE]);
    expect(log.filter((l) => l.startsWith("prepare"))).toEqual(["prepare a.jpg"]);
  });

  it("una foto que el navegador no puede decodificar da el mismo mensaje", async () => {
    const q = createUploadQueue();
    const { d } = deps({
      prepare: async () => {
        throw new Error("decode");
      },
    });
    await q.start([file("rota.jpg")], 15, d);
    expect(q.notices()).toEqual([UNSUPPORTED_MESSAGE]);
    expect(q.items()).toEqual([]);
  });

  it("no pasa del tope: sube solo las que caben y lo dice", async () => {
    const q = createUploadQueue();
    const { d, log } = deps();
    await q.start([file("a.jpg"), file("b.jpg"), file("c.jpg")], 2, d);
    expect(log.filter((l) => l.startsWith("prepare"))).toEqual(["prepare a.jpg", "prepare b.jpg"]);
    expect(q.notices()).toEqual([MAX_PHOTOS_MESSAGE]);
  });

  it("si la base no la registra (tope), borra lo subido y muestra su mensaje", async () => {
    const q = createUploadQueue();
    const { d, log } = deps({
      upload: async () => "casa/x",
      add: async () => {
        throw new DomainError("Máximo 15 fotos.", "validation");
      },
    });
    await q.start([file("a.jpg")], 1, d);
    expect(log).toContain("discard casa/x");
    expect(q.notices()).toEqual(["Máximo 15 fotos."]);
  });

  it("una subida fallida da el mensaje del adaptador", async () => {
    const q = createUploadQueue();
    const { d } = deps({
      upload: async () => {
        throw new DomainError("No pudimos subir esa foto. Intente de nuevo.", "forbidden");
      },
    });
    await q.start([file("a.jpg")], 15, d);
    expect(q.notices()).toEqual(["No pudimos subir esa foto. Intente de nuevo."]);
  });

  it("las fotos en curso ocupan sitio: el tope cuenta las que todavía se suben", async () => {
    const q = createUploadQueue();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { d } = deps({ prepare: async () => (await gate, variants) });
    const first = q.start([file("a.jpg"), file("b.jpg")], 15, d);
    expect(q.inFlight()).toBe(2);
    release();
    await first;
    expect(q.inFlight()).toBe(0);
  });

  it("progreso por foto: preparar, tres objetos y registrar", () => {
    expect(UPLOAD_STEPS).toBe(5);
    expect(progressOf({ phase: "preparing", uploaded: 0 })).toBe(0);
    expect(progressOf({ phase: "uploading", uploaded: 2 })).toBe(3);
    expect(progressOf({ phase: "saving", uploaded: 3 })).toBe(4);
  });
});
