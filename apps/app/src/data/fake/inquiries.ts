// Fake en memoria de las consultas y los favoritos: mismas reglas, orden de comprobaciones y mensajes que las RPCs
// create_inquiry, mark_inquiry_opened y owner_inquiries y que las políticas de favorites (migración fase3_consultas).
// El reloj se inyecta (por defecto, el real) para la deduplicación de 7 días, el límite de 24 h y «hoy» en Costa Rica.
import type { FavoritesApi, InquiriesApi } from "../../domain/api";
import { DomainError } from "../../domain/errors";
import { INQUIRY_MESSAGES as M, costaRicaToday, validateInquiryDraft } from "../../domain/inquiry";
import type { FakeDb, FakeListing } from "./db";

const DAY = 86_400_000;
const DEDUP_MS = 7 * DAY;
const RATE_WINDOW_MS = DAY;
const RATE_LIMIT = 20;

type Opts = { userId: () => string | null; now?: () => number };

function session(opts: Opts): string {
  const id = opts.userId();
  if (!id) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
  return id;
}

/**
 * Reloj estrictamente creciente por base: dos escrituras seguidas nunca comparten instante (en la base, now() de cada
 * transacción), aunque vengan de instancias distintas de la API.
 */
const lastTick = new WeakMap<FakeDb, number>();
function clock(db: FakeDb, now: () => number): () => number {
  return () => {
    const t = Math.max(now(), (lastTick.get(db) ?? 0) + 1);
    lastTick.set(db, t);
    return t;
  };
}

const published = (db: FakeDb, publicId: string): FakeListing | undefined => {
  const l = db.byPublicId(publicId);
  return l && l.status === "active" ? l : undefined;
};

export function createFakeInquiries(db: FakeDb, opts: Opts): InquiriesApi {
  const tick = clock(db, opts.now ?? Date.now);

  return {
    async create(publicId, draft) {
      const uid = session(opts);
      const profile = db.profiles.get(uid);
      if (!profile || !profile.isActive) throw new DomainError(M.inactiveAccount, "validation");
      if (!profile.phoneVerified) throw new DomainError(M.unverified, "validation");
      const l = published(db, publicId);
      if (!l) throw new DomainError(M.notPublished, "validation");
      if (l.ownerId === uid) throw new DomainError(M.ownHouse, "validation");
      if (!l.available) throw new DomainError(M.unavailable, "validation");
      const now = tick();
      const problem = validateInquiryDraft(draft, costaRicaToday(now));
      if (problem) throw new DomainError(problem.message, "validation");

      const others = new Set(
        db.inquiries.filter((i) => i.clientId === uid && Date.parse(i.updatedAt) > now - RATE_WINDOW_MS && i.listingId !== l.id).map((i) => i.listingId),
      );
      if (others.size >= RATE_LIMIT) throw new DomainError(M.rateLimit, "validation");

      const at = new Date(now).toISOString();
      const fields = { arrival: draft.arrival, departure: draft.departure, people: draft.people, message: draft.message.trim(), whatsappPhone: l.whatsappPhone };
      const recent = db.inquiries
        .filter((i) => i.clientId === uid && i.listingId === l.id && Date.parse(i.createdAt) > now - DEDUP_MS)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (recent) {
        Object.assign(recent, fields, { updatedAt: at, ownerOpenedAt: null });
        return { inquiryId: recent.id, whatsappPhone: l.whatsappPhone };
      }
      const id = db.newId();
      db.inquiries.push({ id, listingId: l.id, clientId: uid, ownerId: l.ownerId, ...fields, createdAt: at, updatedAt: at, ownerOpenedAt: null, source: "listing" });
      return { inquiryId: id, whatsappPhone: l.whatsappPhone };
    },

    async listForOwner() {
      const uid = session(opts);
      return db.inquiries
        .filter((i) => i.ownerId === uid)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
        .slice(0, 200)
        .map((i) => {
          const l = db.listings.get(i.listingId)!;
          const client = db.profiles.get(i.clientId)!;
          return {
            id: i.id,
            listingId: i.listingId,
            publicId: l.publicId,
            listingTitle: l.title,
            clientName: client.fullName,
            clientPhone: client.phone,
            arrival: i.arrival,
            departure: i.departure,
            people: i.people,
            message: i.message,
            createdAt: i.createdAt,
            updatedAt: i.updatedAt,
            openedAt: i.ownerOpenedAt,
            source: i.source,
          };
        });
    },

    async markOpened(id) {
      const uid = session(opts);
      const i = db.inquiries.find((x) => x.id === id && x.ownerId === uid);
      if (!i) throw new DomainError(M.notFound, "validation");
      i.ownerOpenedAt ??= new Date(tick()).toISOString();
    },
  };
}

export function createFakeFavorites(db: FakeDb, opts: Opts): FavoritesApi {
  const tick = clock(db, opts.now ?? Date.now);

  function insert(uid: string, publicId: string): boolean {
    const l = published(db, publicId);
    if (!l) return false;
    if (!db.favorites.some((f) => f.userId === uid && f.listingId === l.id)) {
      db.favorites.push({ userId: uid, listingId: l.id, createdAt: new Date(tick()).toISOString() });
    }
    return true;
  }

  return {
    async list() {
      const uid = session(opts);
      return db.favorites
        .filter((f) => f.userId === uid)
        .flatMap((f) => {
          const l = db.listings.get(f.listingId);
          return l && l.status === "active" ? [{ publicId: l.publicId, savedAt: f.createdAt }] : [];
        })
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },

    async add(publicId) {
      if (!insert(session(opts), publicId)) throw new DomainError(M.notPublished, "validation");
    },

    async remove(publicId) {
      const uid = session(opts);
      // Como el adaptador PostgREST, que resuelve el CT-#### en listings_public: solo casas publicadas.
      const l = published(db, publicId);
      if (l) db.favorites = db.favorites.filter((f) => !(f.userId === uid && f.listingId === l.id));
    },

    async addMany(publicIds) {
      const uid = session(opts);
      for (const id of publicIds) insert(uid, id);
    },
  };
}
