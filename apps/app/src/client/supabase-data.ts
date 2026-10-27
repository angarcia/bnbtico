// Datos remotos del navegador: un solo cliente de supabase-js para las lecturas públicas y la cuenta. Se carga bajo
// demanda (supabase-js no entra en el JS inicial): al pedir la primera lista, al ingresar o si ya hay sesión guardada.
import type { AdminListingsApi, AuthApi, FavoritesApi, InquiriesApi, MfaApi, OwnerBillingApi, OwnerCalendarApi, OwnerListingsApi, PhotosApi, PublicListingsApi } from "../domain/api";
import { createBrowserData } from "../data/postgrest/session-client";
import { webStore } from "../data/storage";

let data: ReturnType<typeof createBrowserData> | null = null;

const get = () =>
  (data ??= createBrowserData(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    session: webStore("local"),
    pending: webStore("session"),
  }));

export const publicListings = (): PublicListingsApi => get().listings;
export const authApi = (): AuthApi & MfaApi => get().auth;
export const ownerListings = (): OwnerListingsApi => get().owner;
export const photosApi = (): PhotosApi => get().photos;
export const adminApi = (): AdminListingsApi => get().admin;
export const favoritesApi = (): FavoritesApi => get().favorites;
export const inquiriesApi = (): InquiriesApi => get().inquiries;
export const calendarApi = (): OwnerCalendarApi => get().calendar;
export const ownerBilling = (): OwnerBillingApi => get().billing;
export const accessToken = (): Promise<string | null> => get().accessToken();
