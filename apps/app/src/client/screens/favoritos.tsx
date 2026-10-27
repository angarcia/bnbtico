// Favoritos (pantalla 05): las casas guardadas en este teléfono (y, con sesión, en la cuenta). Trozo diferido.
// Las tarjetas salen de listings_public en una sola consulta (caché pública); las que ya no vuelven se quitan sin avisar.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { describe } from "../../domain/describe";
import { FEATURE_SHORT, type PublicListing } from "../../domain/listing";
import { formatMoney } from "../../domain/money";
import { useCurrency } from "../../shared/currency";
import { useFx } from "../../shared/fx";
import { FavoriteButton } from "../../shared/favorite-button";
import { favoritesStore, useFavorites } from "../../shared/favorites-store";
import { Picture } from "../../shared/picture";
import { RootHeader } from "../chrome";
import { useSession } from "../session";

const favoriteListingsQuery = (ids: string[]) => ({
  queryKey: ["favorite-listings", ids] as const,
  queryFn: async () => (await import("../supabase-data")).publicListings().getManyPublic(ids),
  enabled: ids.length > 0,
  staleTime: 60_000,
  placeholderData: keepPreviousData,
});

function countLine(n: number, signedIn: boolean): string {
  const casas = `${n} ${n === 1 ? "casa" : "casas"}`;
  if (signedIn) return `${casas} ${n === 1 ? "guardada" : "guardadas"}`;
  return `${casas} · ${n === 1 ? "guardada" : "guardadas"} en este teléfono`;
}

function FavoriteCard({ listing: l }: { listing: PublicListing }) {
  const currency = useCurrency();
  const fx = useFx(currency === "USD");
  const cover = l.photos[0];
  const price = describe(l, { base: "" }).mainPrice;
  return (
    <article className="fav-card">
      <div className="photo fav-photo">{cover ? <Picture photo={cover} alt="" sizes="116px" width={480} height={336} /> : null}</div>
      <div className="fav-body">
        <div className="fav-title">
          <h2>
            <Link to="/casa/$publicId" params={{ publicId: l.publicId }} className="stretched">
              {l.title}
            </Link>
          </h2>
          <FavoriteButton publicId={l.publicId} className="heart-row" />
        </div>
        <span className="small muted">{[l.zone, `${l.capacity} pers.`, `${l.bedrooms} hab.`].filter(Boolean).join(" · ")}</span>
        {l.features.length ? <span className="small muted">{l.features.slice(0, 3).map((f) => FEATURE_SHORT[f]).join(" · ")}</span> : null}
        {price ? (
          <span className="fav-price num">
            {formatMoney(price.amount, currency, fx.crcPerUsd)} <span className="muted">/ {price.unit}</span>
          </span>
        ) : null}
      </div>
    </article>
  );
}

function SkeletonCards({ n }: { n: number }) {
  return (
    <div className="stack skeleton" aria-hidden="true">
      {Array.from({ length: Math.min(n, 4) }, (_, i) => (
        <div key={i} className="fav-card">
          <span className="sk fav-photo" />
          <span className="sk sk-line" />
        </div>
      ))}
    </div>
  );
}

export function FavoritosScreen() {
  const favs = useFavorites();
  const status = useSession().status;
  const ids = useMemo(() => favs.map((f) => f.publicId).sort(), [favs]);
  const { data, isPlaceholderData, isError } = useQuery(favoriteListingsQuery(ids));

  // Las casas que ya no están publicadas no vuelven en la consulta: fuera del teléfono, sin avisar.
  useEffect(() => {
    if (!data || isPlaceholderData) return;
    const found = new Set(data.map((l) => l.publicId));
    if (ids.every((id) => found.has(id))) return;
    favoritesStore.replace(favoritesStore.list().filter((f) => found.has(f.publicId) || !ids.includes(f.publicId)));
  }, [data, isPlaceholderData, ids]);

  const byId = new Map(data?.map((l) => [l.publicId, l]));
  const shown = favs.flatMap((f) => byId.get(f.publicId) ?? []);
  const loading = favs.length > 0 && !data;

  return (
    <>
      <RootHeader
        title="Favoritos"
        action={
          <Link
            to="/cuenta"
            search={{ next: "/favoritos" }}
            className={`btn btn-ghost btn-header${status === "signed-out" ? "" : " is-hidden"}`}
            aria-hidden={status !== "signed-out"}
            tabIndex={status === "signed-out" ? undefined : -1}
          >
            Ingresar
          </Link>
        }
        aside={
          favs.length ? (
            <span className="small muted" data-testid="favorites-count">
              {countLine(loading ? favs.length : shown.length, status === "signed-in")}
            </span>
          ) : null
        }
      />

      {favs.length === 0 ? (
        <section className="stack fav-empty">
          <p className="muted">Toque el corazón de una casa para guardarla aquí.</p>
          <Link to="/explorar" className="btn btn-primary btn-lg">
            Explorar casas
          </Link>
        </section>
      ) : loading ? (
        isError ? <div className="note note-arena">No pudimos cargar las casas. Revise su conexión e inténtelo de nuevo.</div> : <SkeletonCards n={favs.length} />
      ) : (
        <div className="stack fav-list">
          {shown.map((l) => (
            <FavoriteCard key={l.publicId} listing={l} />
          ))}
        </div>
      )}

      <div className="note note-col">
        <b>Compare y escriba directo</b>
        <span>Guardar casas no necesita cuenta. Para contactar a un propietario solo tiene que verificar su WhatsApp con un código.</span>
      </div>
    </>
  );
}
