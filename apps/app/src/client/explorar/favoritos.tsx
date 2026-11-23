// Favoritos (pantalla 05): las casas guardadas en este teléfono (y, con sesión, en la cuenta). Trozo diferido.
// Las tarjetas (las de Explorar) salen de listings_public en una sola consulta (caché pública); las que ya no vuelven se quitan
// sin avisar.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { favoritesStore, useFavorites } from "../../shared/favorites-store";
import { ScreenHeader } from "../comun/screen-header";
import { useDesktop } from "../../shared/desktop";
import { CurrencySwitch } from "../../shared/currency-switch";
import { ListingCard } from "./listing-card";
import { useSession } from "../comun/session";
import { RouterButtonLink } from "../comun/router-buttons";
import { EmptyState, LoadError, Notice, Skeleton } from "../../shared/ui/structure";
import { FAVORITES_COPY } from "./copy";

const favoriteListingsQuery = (ids: string[]) => ({
  queryKey: ["favorite-listings", ids] as const,
  queryFn: async () => (await import("../../shared/supabase-data")).publicListings().getManyPublic(ids),
  enabled: ids.length > 0,
  staleTime: 60_000,
  placeholderData: keepPreviousData,
});

export function FavoritosScreen() {
  const desktop = useDesktop();
  const favs = useFavorites();
  const status = useSession().status;
  const ids = useMemo(() => favs.map((f) => f.publicId).sort(), [favs]);
  const { data, isPlaceholderData, isError, refetch } = useQuery(favoriteListingsQuery(ids));

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
      <ScreenHeader kind="root"
        title={FAVORITES_COPY.title}
        aside={
          favs.length ? (
            // Sin logo ni barra arriba (2026-11-03): en una fila, cuántas hay y «₡ | $» para sus precios.
            <div className="row between gap-8 fav-head">
              <span className="small muted" data-testid="favorites-count">
                {FAVORITES_COPY.count({ count: loading ? favs.length : shown.length, signedIn: status === "signed-in" })}
              </span>
              {!desktop && <CurrencySwitch />}
            </div>
          ) : null
        }
      />

      {favs.length === 0 ? (
        <EmptyState
          framed={false}
          placement="fav-empty"
          text={<p className="muted">{desktop ? FAVORITES_COPY.emptyClick : FAVORITES_COPY.emptyTouch}</p>}
          action={<RouterButtonLink to="/explorar" replace variant="primary" size="lg">{FAVORITES_COPY.explore}</RouterButtonLink>}
        />
      ) : loading ? (
        isError ? <LoadError onRetry={() => void refetch()} /> : <Skeleton shape="grid" count={Math.min(favs.length, 4)} />
      ) : (
        // La misma tarjeta que Explorar (2026-11-03): fotos deslizables con puntitos, corazón y botón de WhatsApp que abre la
        // hoja de contacto aquí mismo.
        <div className="listing-grid">
          {shown.map((l, i) => (
            <ListingCard key={l.publicId} listing={l} priority={i === 0} />
          ))}
        </div>
      )}

      <Notice as="div" layout="column">
        <b>{FAVORITES_COPY.noticeTitle}</b>
        <span>{FAVORITES_COPY.noticeText}</span>
      </Notice>
    </>
  );
}
