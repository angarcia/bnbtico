// Arnés PostgREST: siembra por el camino real (dueño inserta y edita, sube fotos, envía con submit_listing; el admin
// decide con review_listing; «reopened», un estado heredado, se siembra con SQL).
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPostgrestAdmin } from "../../src/data/postgrest/admin";
import { createPostgrestOwnerBilling } from "../../src/data/postgrest/billing";
import { createBillingService } from "../../src/data/postgrest/billing-service";
import { createPostgrestCalendar } from "../../src/data/postgrest/calendar";
import { createPostgrestFavorites, createPostgrestInquiries } from "../../src/data/postgrest/inquiries";
import { createPostgrestListings } from "../../src/data/postgrest/listings";
import { createPostgrestOwnerListings } from "../../src/data/postgrest/owner";
import { createPostgrestPhotos } from "../../src/data/postgrest/photos";
import { quickWriter } from "../../src/data/postgrest/session-client";
import { SESSION_STORAGE_KEY, memoryStore } from "../../src/data/storage";
import type { Database } from "../../src/domain/database.types";
import { addDays } from "../../src/domain/calendar";
import { costaRicaToday } from "../../src/domain/inquiry";
import { toListingUpdate } from "../../src/domain/rows";
import { COMPLETE, type SeedOwner, type SeedSpec, type Seeded, type StoredReminder, type SubscriptionHarness } from "../contract/harness";
import { TEST_NAMES, TEST_PHONES, anonClient, localSupabase, serviceClient, signIn, signInAdmin, sql } from "./local";

export async function postgrestHarness(): Promise<SubscriptionHarness> {
  const service = serviceClient();
  const owners: Record<SeedOwner, SupabaseClient<Database>> = { owner: await signIn("owner"), other: await signIn("other") };
  // El admin decide con el segundo factor (aal2): sin él, review_listing lo rechaza (migración admin_aal2_y_purga).
  const admin = await signInAdmin();
  const adminAal1 = await signIn("admin");
  // Las escrituras con `known` van por el camino sin esperas del navegador (token guardado y segundo cliente).
  const quick = {} as Record<SeedOwner, ReturnType<typeof quickWriter>>;
  for (const who of ["owner", "other"] as const) {
    const store = memoryStore();
    store.setItem(SESSION_STORAGE_KEY, JSON.stringify((await owners[who].auth.getSession()).data.session));
    quick[who] = quickWriter(localSupabase().url, localSupabase().anonKey, store);
  }
  const names = {} as Record<SeedOwner, string>;
  for (const who of ["owner", "other"] as const) {
    const id = (await owners[who].auth.getUser()).data.user!.id;
    names[who] = (await service.from("profiles").select("full_name").eq("id", id).single()).data?.full_name ?? TEST_NAMES[who];
  }
  const fail = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };

  async function seed(spec: SeedSpec): Promise<Seeded> {
    const db = owners[spec.as ?? "owner"];
    const ownerId = (await db.auth.getUser()).data.user!.id;
    const draft = { ...COMPLETE, ...spec.draft };
    const created = await db
      .from("listings")
      .insert({ owner_id: ownerId, title: "", description: "", province: "Limón", whatsapp_phone: TEST_PHONES[spec.as ?? "owner"] })
      .select("id, public_id")
      .single();
    fail("crear borrador", created.error);
    const { id, public_id: publicId } = created.data!;
    fail("editar borrador", (await db.from("listings").update(toListingUpdate(draft)).eq("id", id)).error);
    const n = spec.photos ?? (spec.status === "draft" ? 0 : 5);
    const photoPaths = Array.from({ length: n }, (_, i) => `${id}/foto-${i}.jpg`);
    if (n > 0) {
      const rows = photoPaths.map((path, position) => ({ listing_id: id, path, position })).reverse();
      // Con la service role: tras el corte, authenticated ya no inserta en listing_photos (solo las RPCs; ver
      // supabase/migrations-pendientes/). Los nombres antiguos sin objeto no pasarían por add_listing_photo.
      fail("fotos", (await service.from("listing_photos").insert(rows)).error);
    }
    if (spec.status !== "draft") {
      // submit_listing exige una foto (publicar avanza siempre, 2026-10-30): una casa «en revisión sin fotos» (que el admin
      // no puede aprobar) se siembra con una foto provisional que se quita justo después de enviar.
      const placeholder = n === 0 ? await service.from("listing_photos").insert({ listing_id: id, path: `${id}/provisional.jpg`, position: 0 }).select("id").single() : null;
      if (placeholder) fail("foto provisional", placeholder.error);
      fail("enviar", (await db.rpc("submit_listing", { p_listing: id })).error);
      if (placeholder) fail("quitar la foto provisional", (await service.from("listing_photos").delete().eq("id", placeholder.data!.id)).error);
    }
    const decision = { active: "approve", reopened: "approve", changes: "changes", rejected: "reject" } as const;
    if (spec.status in decision) {
      const d = decision[spec.status as keyof typeof decision];
      fail("revisar", (await admin.rpc("review_listing", { p_listing: id, p_decision: d, p_note: d === "approve" ? "" : "Faltan fotos del baño." })).error);
    }
    // Estado heredado (una casa activa vuelta a borrador): desde la migración editar_casa_publicada ningún propietario
    // llega a él, así que se siembra como el servicio.
    if (spec.status === "reopened") sql(`begin; select set_config('app.allow_status','on',true); update public.listings set status = 'draft' where id = '${id}'; commit;`);
    return { id, publicId, exact: { lat: draft.lat!, lng: draft.lng! }, photoPaths };
  }

  const ids = {} as Record<SeedOwner, string>;
  for (const who of ["owner", "other"] as const) ids[who] = (await owners[who].auth.getUser()).data.user!.id;
  const anon = anonClient();

  const adminId = (await admin.auth.getUser()).data.user!.id;
  const today = () => costaRicaToday(Date.now());

  return {
    billing: (who) => createPostgrestOwnerBilling(who === "anon" ? anon : owners[who]),
    service: createBillingService({ supabaseUrl: localSupabase().url, serviceKey: localSupabase().serviceKey, anonKey: localSupabase().anonKey, fetch }),
    ownerId: (who) => ids[who],
    async jwt(who) {
      return (await owners[who].auth.getSession()).data.session!.access_token;
    },
    async takeSlots(n) {
      const base = { owner_id: adminId, status: "inactive" as const, description: "x", province: "Limón", whatsapp_phone: TEST_PHONES.admin, capacity: 2, bedrooms: 1, bathrooms: 1, accepts_nightly: true, nightly_price_crc: 30000 };
      const created = await service.from("listings").insert(Array.from({ length: n }, (_, k) => ({ ...base, title: `Relleno ${k + 1}` }))).select("id, title");
      fail("sembrar relleno", created.error);
      const rows = created.data!.map((l) => ({ listing_id: l.id, plan: "promo" as const, promo_slot: Number(l.title.slice(8)), promo_months: 12, promo_ends_on: addDays(today(), 365) }));
      fail("sembrar plazas", (await service.from("subscriptions").insert(rows)).error);
    },
    async setDaysLeft(listingId, days) {
      fail("mover la oferta", (await service.from("subscriptions").update({ promo_ends_on: addDays(today(), days) }).eq("listing_id", listingId)).error);
    },
    async setAccountActive(who, active) {
      fail("cuenta", (await service.from("profiles").update({ is_active: active }).eq("id", ids[who])).error);
    },
    async reminders(listingId) {
      const { data, error } = await service
        .from("subscription_reminders")
        .select("days_before, status, attempts, to_phone, body, provider_ref, sent_at")
        .eq("listing_id", listingId)
        .order("days_before", { ascending: false });
      fail("avisos", error);
      return data!.map(
        (r): StoredReminder => ({ daysBefore: r.days_before, status: r.status as StoredReminder["status"], attempts: r.attempts, toPhone: r.to_phone, body: r.body, providerRef: r.provider_ref, sentAt: r.sent_at }),
      );
    },
    async storedMethod(who) {
      const { data, error } = await service.from("payment_methods").select("customer_ref, method_ref").eq("owner_id", ids[who]).maybeSingle();
      fail("método", error);
      return data ? { customerRef: data.customer_ref, methodRef: data.method_ref } : null;
    },
    async setTestClock(on) {
      const was = sql("select count(*) from vault.secrets where name = 'bnbtico_test_clock'") !== "0";
      sql("delete from vault.secrets where name = 'bnbtico_test_clock'");
      if (on) sql("select vault.create_secret('on', 'bnbtico_test_clock')");
      return was;
    },
    async adminActions(listingId) {
      const { data, error } = await service.from("admin_actions").select("action, reason").eq("target_listing_id", listingId).like("action", "listing.%").not("action", "in", "(listing.approve,listing.changes,listing.reject)").order("created_at", { ascending: true });
      fail("acciones del admin", error);
      return data!;
    },
    async backdateHold(listingId, days) {
      sql(`begin; select set_config('app.allow_status','on',true); update public.listings set admin_hold_at = admin_hold_at - interval '${days} days' where id = '${listingId}'; commit;`);
    },
    inquiries: (who) => createPostgrestInquiries(who === "anon" ? anon : owners[who]),
    favorites: (who) => createPostgrestFavorites(who === "anon" ? anon : owners[who]),
    calendar: (who) => createPostgrestCalendar(who === "anon" ? anon : owners[who]),
    async reopenDue(today) {
      const { data, error } = await service.rpc("reopen_due_listings", { p_today: today });
      fail("reabrir casas", error);
      return data!;
    },
    async putDay(listingId, row) {
      const { error } = await service.from("listing_days").upsert({ listing_id: listingId, day: row.day, available: row.available, special_price_crc: row.specialPriceCrc });
      fail("escribir día", error);
    },
    phone: (who) => TEST_PHONES[who],
    async backdateInquiry(id, days) {
      const { data } = await service.from("inquiries").select("created_at, updated_at").eq("id", id).single();
      const back = (iso: string) => new Date(Date.parse(iso) - days * 86_400_000).toISOString();
      fail("atrasar consulta", (await service.from("inquiries").update({ created_at: back(data!.created_at), updated_at: back(data!.updated_at) }).eq("id", id)).error);
    },
    async recordViews(publicId, n, daysAgo = 0) {
      const created_at = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
      const row = { name: "listing_view", listing_public_id: publicId, page: "ficha", path: `/casa/${publicId}`, build: "prueba", created_at };
      fail("registrar visitas", (await service.from("events").insert(Array.from({ length: n }, () => row))).error);
    },
    async recordTaps(publicId, n, daysAgo = 0) {
      const created_at = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
      const row = { name: "whatsapp_tap", listing_public_id: publicId, page: "ficha", path: `/casa/${publicId}`, build: "prueba", created_at };
      fail("registrar toques", (await service.from("events").insert(Array.from({ length: n }, () => row))).error);
    },
    async seedContacts(who, n) {
      const other = who === "owner" ? "other" : "owner";
      const base = { owner_id: ids[other], status: "active" as const, title: "Contactada", description: "x", province: "Limón", whatsapp_phone: TEST_PHONES[other], capacity: 2, bedrooms: 1, bathrooms: 1, accepts_nightly: true, nightly_price_crc: 30000 };
      const created = await service.from("listings").insert(Array.from({ length: n }, (_, k) => ({ ...base, title: `Contactada ${k}` }))).select("id");
      fail("sembrar casas contactadas", created.error);
      const at = new Date(Date.now() - 3_600_000).toISOString();
      const rows = created.data!.map((l) => ({ listing_id: l.id, client_id: ids[who], owner_id: ids[other], message: "Hola", whatsapp_phone: TEST_PHONES[other], created_at: at, updated_at: at }));
      fail("sembrar consultas", (await service.from("inquiries").insert(rows)).error);
    },
    anon: createPostgrestListings(anon, { supabaseUrl: localSupabase().url }),
    owner: (who) => createPostgrestOwnerListings(owners[who], { supabaseUrl: localSupabase().url, quickWrite: quick[who] }),
    async reset() {
      fail("vaciar casas", (await service.from("listings").delete().not("id", "is", null)).error);
      // El método de pago es de la cuenta (no se borra con las casas) y cambia la regla de aprobar: fuera en cada caso.
      fail("vaciar métodos", (await service.from("payment_methods").delete().not("owner_id", "is", null)).error);
      fail("vaciar clientes", (await service.from("payment_customers").delete().not("owner_id", "is", null)).error);
      fail("vaciar eventos", (await service.from("payment_events").delete().not("event_id", "is", null)).error);
      await emptyBucket(service);
    },
    seed,
    async addPhotos(listingId, n, as = "owner") {
      const db = owners[as];
      const { count } = await db.from("listing_photos").select("id", { count: "exact", head: true }).eq("listing_id", listingId);
      const start = count ?? 0;
      const paths = Array.from({ length: n }, (_, i) => `${listingId}/extra-${start + i}.jpg`);
      fail("fotos", (await service.from("listing_photos").insert(paths.map((path, i) => ({ listing_id: listingId, path, position: start + i })))).error);
      return paths;
    },
    ownerName: (who) => names[who],
    photos: (who) => createPostgrestPhotos(owners[who], { supabaseUrl: localSupabase().url }),
    admin: (as) => createPostgrestAdmin(as === "aal2" ? admin : as === "aal1" ? adminAal1 : owners[as], { supabaseUrl: localSupabase().url }),
    async dropPhoto(listingId) {
      const { data } = await service.from("listing_photos").select("id").eq("listing_id", listingId).order("position", { ascending: false }).limit(1).single();
      fail("quitar foto", (await service.from("listing_photos").delete().eq("id", data!.id)).error);
    },
    async setLegacyTitle(listingId, title) {
      sql(`begin; select set_config('app.allow_status','on',true); update public.listings set title = '${title.replace(/'/g, "''")}' where id = '${listingId}'; commit;`);
    },
    async setClosed(listingId, closed, reopenAt = null) {
      const at = closed && reopenAt ? `'${reopenAt}'` : "null";
      sql(`begin; select set_config('app.allow_status','on',true); update public.listings set available = ${!closed}, reopen_at = ${at} where id = '${listingId}'; commit;`);
    },
    async objects(listingId) {
      const found: { name: string; cacheControl: string | null }[] = [];
      const walk = async (prefix: string) => {
        const { data, error } = await service.storage.from("listings").list(prefix, { limit: 1000 });
        fail("listar Storage", error);
        for (const entry of data ?? []) {
          const name = `${prefix}/${entry.name}`;
          if (entry.id === null) await walk(name);
          else found.push({ name, cacheControl: (entry.metadata?.cacheControl as string | undefined) ?? null });
        }
      };
      await walk(listingId);
      return found.sort((a, b) => (a.name < b.name ? -1 : 1));
    },
  };
}

/** Storage no se vacía con las filas: se recorre el bucket (casa → foto → variantes) y se borra todo. */
async function emptyBucket(service: SupabaseClient<Database>) {
  const bucket = service.storage.from("listings");
  const names: string[] = [];
  const walk = async (prefix: string, depth: number) => {
    const { data } = await bucket.list(prefix, { limit: 1000 });
    for (const entry of data ?? []) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null && depth < 3) await walk(name, depth + 1);
      else if (entry.id !== null) names.push(name);
    }
  };
  await walk("", 0);
  for (let i = 0; i < names.length; i += 500) await bucket.remove(names.slice(i, i + 500));
}
