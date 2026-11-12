// Adaptador PostgREST de las consultas y los favoritos. Las consultas solo pasan por las RPCs (la tabla no se escribe por
// REST y su whatsapp_phone no se lee); los mensajes P0001 de la base pasan tal cual. Los favoritos son la tabla
// `favorites` con RLS (solo casas publicadas); el CT-#### se resuelve contra listings_public.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FavoritesApi, InquiriesApi } from "../../domain/api";
import type { Database } from "../../domain/database.types";
import { DomainError, toDomainError } from "../../domain/errors";
import { INQUIRY_MESSAGES } from "../../domain/inquiry";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function me(db: SupabaseClient<Database>): Promise<string> {
  const { data } = await db.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
  return id;
}

export function createPostgrestInquiries(db: SupabaseClient<Database>): InquiriesApi {
  return {
    async create(publicId, draft) {
      await me(db);
      // Los tipos generados no marcan los argumentos de la RPC como opcionales; la base acepta null en fechas y personas.
      const args = { p_public_id: publicId, p_arrival: draft.arrival, p_departure: draft.departure, p_people: draft.people, p_message: draft.message };
      const { data, error } = await db.rpc("create_inquiry", args as Database["public"]["Functions"]["create_inquiry"]["Args"]).single();
      if (error) throw toDomainError(error);
      return { inquiryId: data.inquiry_id, whatsappPhone: data.whatsapp_phone };
    },

    async listForOwner() {
      await me(db);
      const { data, error } = await db.rpc("owner_inquiries");
      if (error) throw toDomainError(error);
      return data.map((r) => ({
        id: r.id,
        listingId: r.listing_id,
        publicId: r.public_id,
        listingTitle: r.listing_title,
        clientName: r.client_name,
        clientPhone: r.client_phone,
        arrival: r.arrival ?? null,
        departure: r.departure ?? null,
        people: r.people ?? null,
        message: r.message,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        openedAt: r.owner_opened_at ?? null,
        source: r.source === "support" ? "support" : "listing",
      }));
    },

    async markOpened(id) {
      await me(db);
      if (!UUID.test(id)) throw new DomainError(INQUIRY_MESSAGES.notFound, "validation");
      const { error } = await db.rpc("mark_inquiry_opened", { p_id: id });
      if (error) throw toDomainError(error);
    },
  };
}

export function createPostgrestFavorites(db: SupabaseClient<Database>): FavoritesApi {
  /** CT-#### → id de las casas publicadas (las demás no vuelven). */
  async function resolve(publicIds: string[]): Promise<Map<string, string>> {
    if (publicIds.length === 0) return new Map();
    const { data, error } = await db.from("listings_public").select("id, public_id").in("public_id", publicIds);
    if (error) throw toDomainError(error);
    return new Map(data.flatMap((r) => (r.id && r.public_id ? [[r.public_id, r.id] as const] : [])));
  }

  async function insert(userId: string, listingIds: string[]) {
    if (listingIds.length === 0) return;
    const rows = listingIds.map((listing_id) => ({ user_id: userId, listing_id }));
    const { error } = await db.from("favorites").upsert(rows, { onConflict: "user_id,listing_id", ignoreDuplicates: true });
    if (error) throw toDomainError(error);
  }

  return {
    async list() {
      await me(db);
      const { data, error } = await db.from("favorites").select("created_at, listings_public!inner(public_id)").order("created_at", { ascending: false });
      if (error) throw toDomainError(error);
      return data.flatMap((r) => (r.listings_public.public_id ? [{ publicId: r.listings_public.public_id, savedAt: r.created_at }] : []));
    },

    async add(publicId) {
      const uid = await me(db);
      const id = (await resolve([publicId])).get(publicId);
      if (!id) throw new DomainError(INQUIRY_MESSAGES.notPublished, "validation");
      await insert(uid, [id]);
    },

    async remove(publicId) {
      await me(db);
      const id = (await resolve([publicId])).get(publicId);
      if (!id) return;
      const { error } = await db.from("favorites").delete().eq("listing_id", id);
      if (error) throw toDomainError(error);
    },

    async addMany(publicIds) {
      const uid = await me(db);
      const ids = await resolve([...new Set(publicIds)]);
      await insert(uid, [...ids.values()]);
    },
  };
}
