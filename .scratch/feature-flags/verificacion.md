# Épica #57 · verificación (#64) · 2026-11-17

Entorno: **local** (Mac, worktree `casa-tica-flags`, rama `flags-base`, Supabase local, Chrome). En pruebas.3bstays.com queda pendiente: lo recorre Ana con la matriz de `docs/pruebas-manuales.md`, sección 5b.

| Escenario | Cómo se comprobó | Resultado |
| --- | --- | --- |
| A · inicial | Build sin variables; Playwright completo (372 pasan; se saltan las de fechas, habitaciones y precios); navegador en móvil y laptop para noches y WhatsApp | Correcto. `3btico` falla a veces al abrir la suite completa (dependencia de orden previa, pasa sola) |
| B · fechas (y fechas + noches) | Build `FLAG_EXPLORAR_FECHAS=true`; buscar, contacto, explorar-mapa, explorar y ficha-calendario: 65 pasan | Correcto; mandan las fechas. En CI, paso «Búsqueda por fechas» |
| C · ninguna | Build `FLAG_EXPLORAR_NOCHES=false`; `explorar-sin-estancia.spec.ts`: 2 pasan | Correcto (sin build en CI) |
| D · precios | `tests/db/precios-fecha-flag.test.ts` (apagada y vuelta a encender) y suite de base con la flag encendida | Correcto en la base; la pantalla del calendario sin precio, por Playwright (`calendario.spec.ts`) |
| E · habitaciones | `tests/db/habitaciones-flag.test.ts` (apagada, borrador conservado, envío directo rechazado, borrado de la migración) y suite de base con la flag encendida | Correcto en la base; pantallas por Playwright (Publicar, Filtros, Editar) |
| F · iCal | — | Pendiente de #63 (prioridad baja) |
| Valor inválido | `tests/unit/flags.test.ts` y `FLAG_ICAL=si pnpm build` | El build se para con el nombre de la variable |
| Contrato directo | Pruebas de base con llamadas como anfitrión | Mismo mensaje que la app |

## Antes de llevarlo a pruebas (Ana)

1. Copia de la base de `bnbtico-pruebas` antes de la migración que elimina las habitaciones (`docs/copias-de-seguridad.md`).
2. Aplicar y comprobar las migraciones en pruebas antes del `git push` (regla «db push antes de git push»): `20261117160000_feature_flags`, `20261117170000_habitaciones_flag`, `20261117180000_precios_fecha_flag` y `20261117181000_precios_fecha_flag_texto`.
3. Push de `flags-base` y PR a `develop` (toca base y CI).
4. Tras el despliegue, recorrer la matriz (sección 5b de `docs/pruebas-manuales.md`) y apuntar los resultados.
