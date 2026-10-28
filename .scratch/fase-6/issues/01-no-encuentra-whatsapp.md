# 01 · «¿No encuentra lo que busca?» por WhatsApp en Explorar

Status: ready-for-agent
Blocked by: nada
Fecha: 2026-10-27 · Decisión: `docs/decisiones.md` (2026-10-27, «Fase 6 aplazada…»)

## What to build

Sustituto de la fase 6 aplazada: en Explorar, una nota que lleva al WhatsApp de atención a clientes con un mensaje ya redactado a partir de la búsqueda, para que bnbtico ayude a mano a quien no encuentra casa. Más un evento propio para medir cuántas veces se usa (es lo que dirá cuándo retomar «Buscan casa»).

- **Dónde:** Explorar (`src/client/screens/explorar.tsx`), en dos sitios: (1) cuando no hay resultados, sustituye a la tarjeta «Sin resultados con esos filtros.»; (2) al final de la rejilla cuando hay resultados. No en la ficha, ni en Favoritos, ni en la portada.
- **Copy (usted):**
  - Sin resultados: título «No hay casas con esos filtros», texto «¿No encuentra lo que busca? Cuéntenos qué necesita por WhatsApp y le ayudamos a encontrar casa.», y además el enlace «Quitar filtros» si hay filtros puestos (que vuelva a la búsqueda por defecto de la provincia).
  - Con resultados: nota arena «¿No encuentra lo que busca? Cuéntenos qué necesita por WhatsApp y le ayudamos a encontrar casa.»
  - Acción: botón en contorno verde «Escribir a bnbtico por WhatsApp» (no verde WhatsApp: el diseño reserva ese color para «Contactar / Abrir WhatsApp» con un propietario; si el resultado en pantalla lo pide, proponerlo en el cierre con captura). Un solo botón relleno por pantalla: este no lo es.
- **Mensaje redactado** (función pura en el dominio, p. ej. `searchHelpMessage(filters)` en un módulo pequeño; Vitest): «Hola, estoy buscando casa en bnbtico.» y, solo si los hay, «Zona: Limón.», «Personas: 4.», «Modalidad: Vacacional.» (o «Mensual»; nada si son las dos o ninguna), «Necesito: Piscina, Mascotas.» (etiquetas de la lista única de características), «Precio por noche: hasta ₡80 000.» (en colones, como guarda la búsqueda); y al final «Fechas: » vacío para que el cliente las escriba. «Todas las zonas» no se escribe. Sin datos personales (no hay ninguno en Explorar).
- **Enlace:** `waLink(SUPPORT.guest.number, texto)` de `src/client/support.ts` (el mismo número que Ayuda), en la misma pestaña como el resto de enlaces de soporte (mirar cómo lo abre Ayuda en `cuenta.tsx` y hacer lo mismo). **Sin número configurado (`VITE_WA_GUESTS` vacío) la nota no sale** (en el vacío queda solo «No hay casas con esos filtros» y «Quitar filtros»).
- **Evento `search_help_tap`** al tocar el botón, por el mismo camino que `whatsapp_tap` (baliza `/events`: solo ruta, página, build y país; ni el texto del mensaje ni los filtros). Añadirlo a `telemetry.ts` (zod) y a la restricción `events_name_check` con una migración nueva (`pnpm exec supabase migration new evento_ayuda_busqueda < /dev/null`, aplicar solo en local, `db:types`). **Despliegue:** comprobar qué hace el worker si la base rechaza el nombre (migración aún sin aplicar en `bnbtico-pruebas`): debe tragarse el error y responder igual que hoy, sin romper nada en la pantalla; si no es así, decirlo en el informe antes de seguir. Añadir la consulta de cuántos toques hubo por semana en `docs/telemetria.md`.

## Acceptance

- [ ] Vitest del mensaje: sin filtros; provincia; «Todas las zonas»; personas; cada modalidad y las dos; características; precio máximo; que «Fechas: » vaya al final; que nunca salga «undefined» ni dobles espacios.
- [ ] Costura del worker: `/events` acepta `search_help_tap` y guarda solo lo de siempre; base: la restricción acepta el nombre nuevo y sigue rechazando uno desconocido.
- [ ] Playwright Pixel 7 (`tests/e2e/`): con filtros sin resultados → «No hay casas con esos filtros», el botón lleva a `https://wa.me/<número de soporte>?text=…` con el mensaje esperado (interceptado, sin salir a internet) y «Quitar filtros» vuelve a mostrar casas; con resultados → la nota al final de la rejilla; sin `VITE_WA_GUESTS` → sin nota (si hace falta, un build aparte o una variable de prueba; elegir lo más simple y explicarlo). Cada prueba crea sus casas y no supone recuentos globales.
- [ ] Capturas Pixel 7 revisadas (vacío y con resultados, a 360 px y 412 px), para enseñárselas a Daniel.
- [ ] Sin tocar la ficha `/casa/CT-####` ni su camino: Lighthouse ficha ≤ 1,70 s; CSP sin cambios.
- [ ] Tamaño: Explorar va en el JS inicial; la zona privada no pasa de **142,6 KB gz** (hoy 142,16 de 150) y las pantallas de las pestañas no suben de 24,5. Sin subir ningún límite.
- [ ] Todas las baterías en verde desde `apps/app`: `typecheck`, `test`, `test:db`, `build`, `size`, `test:e2e`, `lighthouse`; los `tests/prototype/*.cjs` siguen pasando.
- [ ] `docs/telemetria.md` con el evento y su consulta; `docs/decisiones.md` solo si hay alguna decisión de implementación que no esté aquí.
