-- «Cerrar la casa hasta…» sale de la app (ronda de Ana del 2026-11-02, ticket 04): el anfitrión ya no cierra una casa
-- entera, marca las noches de una reserva como ocupadas en su calendario. Las casas que ya estuvieran cerradas se abren
-- (sus noches y precios no se tocan).
-- No se borran la columna reopen_at, la RPC set_listing_available ni el trabajo pg_cron bnbtico-reabrir-casas: se retiran
-- más adelante (decisión 2026-11-02). Sin casas cerradas, el trabajo nocturno no encuentra nada que abrir.

select set_config('app.allow_status', 'on', true);
update public.listings set available = true, reopen_at = null where not available;
