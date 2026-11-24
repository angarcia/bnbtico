# Estructura del frontend: propuesta contrastada con guías (borrador para Ana, 2026-11-22)

Estado: **aprobada por Ana el 2026-11-22** con las opciones por defecto de §5 (sin idioma ni fecha prevista para traducir); anotada en `docs/decisiones.md`. No se ha cambiado código. Amplía las cinco sugerencias de la conversación del 2026-11-22 (y sacar los textos, que pidió Ana) con lo que dicen guías reconocidas, y las contrasta con `apps/app/src` tal como está hoy.

## 1. Guías consultadas

| Tema | Guía | Qué se toma |
|---|---|---|
| Carpetas y dependencias | [Bulletproof React · Project structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) | Carpetas por funcionalidad (*features*); dependencias en un solo sentido `shared → features → app`; las funcionalidades no se importan entre sí y se componen en la capa de la app; sin archivos «barril» (`index.ts` que reexportan), porque estorban al *tree shaking*; la regla se hace cumplir con una comprobación automática. |
| Colocación | [Kent C. Dodds · Colocation](https://kentcdodds.com/blog/colocation) | «Lo que cambia junto, junto»: pruebas, estilos y estado cerca de donde se usan. Las e2e y la documentación general quedan en la raíz. |
| Consultas | [TkDodo · The Query Options API](https://tkdodo.eu/blog/the-query-options-api) (mantenedor de TanStack Query) | Una «fábrica» de `queryOptions` por recurso (clave + función juntas, tipadas); se usa igual en `useQuery`, `prefetchQuery` y `setQueryData`. Un hook que solo envuelve `useQuery` sobra. |
| Rutas | [TanStack Router · Code splitting](https://tanstack.com/router/latest/docs/framework/react/guide/code-splitting) | Lo crítico de una ruta (búsqueda, `beforeLoad`, cargadores) va en la definición; el componente, en trozo diferido. `getRouteApi` para usar la ruta sin importarla. |
| Hooks | [React · Reusing logic with custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) | Extraer hooks con un propósito concreto y nombre claro (`useOnlineStatus`), sobre todo para encapsular efectos; nada de hooks genéricos (`useMount`); «algo de duplicación está bien». |
| CSS | [MDN · Organizing your CSS](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Organizing) y [MDN · @layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) | De lo general a lo específico; archivos por sección del sitio; selectores simples. Las capas en cascada (`@layer`, disponibles en todos los navegadores desde 2022) ordenan la prioridad sin pelear con la especificidad. |
| Textos y traducción | [W3C · Internationalization quick tips](https://www.w3.org/International/quicktips/) | No componer frases a trozos; parámetros con nombre o posición, no fijos; dejar sitio a que el texto crezca; `lang` en el documento; formatos locales de fecha, cifras y direcciones. |
| Librerías de traducción | [Paraglide JS](https://paraglidejs.com/) (v2) y [Lingui](https://lingui.dev/introduction) (6.x) | Ver §3.6. |

## 2. Dónde está el código hoy frente a esas guías

Ya cumple bien:

- **Dependencias del dominio en un solo sentido**, comprobadas por pruebas (`tests/unit/architecture.test.ts`): el dominio sin frameworks, supabase-js solo en el adaptador. El proyecto hace cumplir sus reglas con pruebas de Vitest, no con ESLint (no hay linter instalado); conviene seguir así.
- **Componentes comunes** con props cerradas y su prueba de consistencia (historia 07).
- **Trozos diferidos por pantalla** con `lazyRouteComponent` y rutas definidas en código: es el patrón documentado de TanStack Router para rutas en código.
- `queryOptions` ya se usa en ~10 módulos (`admin.ts`, `queries.ts`, `billing.ts`…).

Se aparta de las guías:

| Hallazgo | Guía que lo señala |
|---|---|
| `client/` tiene 69 archivos sueltos que mezclan consultas, lógica y piezas de todas las áreas; `client/screens/` mezcla 33 pantallas de todas las áreas; `client/publish/` sí está agrupado. | Bulletproof (por funcionalidad), colocación |
| `shared/` mezcla los componentes comunes (`button`, `field`, `overlay`…) con piezas de la ficha (`listing-page`, `contact-sheet`, `hero-gallery`). | Bulletproof (`components` frente a `features`) |
| 28 `useQuery({ … })` escritos en línea, con la clave y la función en la pantalla. | TkDodo |
| Pantallas de 390–565 líneas; `calendario.tsx` tiene 9 `useEffect` y `publicar.tsx` 7. | React (hooks con propósito) |
| `styles/13-escritorio.css` (819 de 2 212 líneas) junta el escritorio de todas las pantallas, ordenado por «tandas» de revisión, y depende de ir el último y de la especificidad (comentario de la línea 635: «Más específico que…»). Todo el CSS (13 archivos) se carga siempre desde `main.tsx`. | MDN (por sección, de lo general a lo específico), `@layer` |
| Los textos están escritos dentro de los componentes y en `domain/status-label.ts`. | W3C (preparar la traducción) |
| Nombres de archivo en dos idiomas sin regla (`calendario.tsx`, `mark-sheet.tsx`). | MDN («la coherencia es importante») |

## 3. Propuesta

### 3.1 Carpetas por área, con dependencias en un solo sentido

```
src/
  domain/   data/   server/   sw/        (sin cambios)
  shared/
    ui/          componentes comunes de la historia 07 (button, field, overlay, card, structure…)
    …            lo demás que pinta la ficha SSR (listing-page, contact-sheet, hero-gallery, mapa…)
  client/
    app/         arranque: main, shell (rutas), sesión, persistencia, service worker, chrome
    explorar/    explorar, buscar, filtros, mapa, favoritos
    casa/        hidratación de la ficha, tarjetas, compartir
    publicar/    asistente, pasos, fotos, ubicación (hoy client/publish/)
    propietario/ mis casas, detalle, editar, calendario, suscripción, actividad, Airbnb
    cuenta/      cuenta, ingreso, código, ayuda
    admin/       cola, revisión, casas, código
    comun/       lo que usan dos o más áreas y no es un componente (p. ej. consultas de la cuenta)
```

Cada área junta su pantalla, sus consultas (`queries.ts`), sus hooks y sus piezas; sin archivos barril. Reglas, en `architecture.test.ts`:

- `shared/ui` no importa nada de `client/` ni de otras partes de `shared/`; `shared/` no importa `client/`.
- Un área no importa otra área; lo común baja a `client/comun/` o a `shared/`. `client/app/` sí importa las áreas (compone las rutas). Las excepciones reales se listan con su motivo, como en la prueba de consistencia.

Nombres: carpetas de área en español (son las pantallas que ve el usuario); archivos de código en inglés, como las entidades (regla para `CONTEXT.md`). Las rutas (URL) no cambian.

No se adopta el enrutado por archivos con división automática de TanStack Router: lo recomiendan, pero cambiaría cómo se definen todas las rutas y el reparto actual ya cumple el presupuesto.

### 3.2 Consultas: una fábrica de `queryOptions` por recurso

En cada área, `queries.ts` exporta objetos como `ownerQueries.detail(id)` que devuelven `queryOptions` (clave y función juntas). Las pantallas llaman `useQuery(ownerQueries.detail(id))`; las invalidaciones usan las claves de la fábrica. Encaja con la regla del proyecto de «una función de consulta por pantalla» y con el adaptador `ListingsApi` (la fábrica llama al adaptador, nunca a PostgREST directamente).

### 3.3 Pantallas grandes: hooks con propósito

Al tocar cada pantalla grande (calendario, suscripción, propietario, editar, explorar), sacar sus efectos a hooks con nombre de lo que hacen (p. ej. `useMarkedNights`, `useSubscriptionStatus`) y partir el dibujo en bloques. Sin hooks genéricos ni una reescritura de golpe.

### 3.4 CSS: por área y en capas

- Un archivo por área junto a su carpeta (`client/propietario/propietario.css`…), con sus reglas de escritorio dentro de `@media (min-width: 1024px)` en el mismo archivo. `13-escritorio.css` queda solo con el marco común (barra superior, ventanas, estado al pasar el ratón).
- Capas declaradas una vez: `@layer tokens, base, componentes, areas, marco;`. Así el orden manda y no hace falta subir la especificidad para que gane el escritorio.
- `que-es-3bstays.css` ya se importa desde su pantalla: es el precedente. Riesgos a medir antes: que el CSS de un trozo diferido no llegue tarde (parpadeo) y que la ficha SSR siga recibiendo todo su CSS en la primera respuesta.

### 3.5 Catálogo vivo de componentes

Ruta solo de desarrollo y pruebas (`/_componentes`, 404 en producción, como `/_pruebas`) con cada componente en sus variantes y estados, y una captura de Playwright en móvil y escritorio. Es la práctica de Storybook sin añadir la dependencia; no sale de las guías de arriba.

### 3.6 Textos fuera del código, preparados para traducir

Prácticas del W3C que se aplican desde el primer paso, haya o no otro idioma: mensajes completos con parámetros con nombre (nunca frases a trozos), plurales con `Intl.PluralRules`, cifras y fechas con `Intl` y el formateador del proyecto, una nota de contexto donde el texto sea ambiguo, y dejar crecer los textos en el diseño.

Opciones:

| | A mano (catálogos TypeScript) | Paraglide JS v2 | Lingui 6 |
|---|---|---|---|
| Cómo | Un objeto `as const` por área con funciones para lo que lleva parámetros | Compila los mensajes a funciones tipadas; el empaquetador quita las que no se usan | Macros en el código; extrae los textos a catálogos (PO, JSON); runtime de unos 2 kB |
| Claves | Las nuestras, tipadas | Las nuestras, tipadas | Por defecto, el propio texto (un cambio de texto se vuelve a traducir); admite claves |
| Plurales | `Intl.PluralRules` a mano | `Intl.PluralRules` | ICU MessageFormat |
| Herramientas para traductores | Ninguna | Formato inlang, JSON, XLIFF | PO, el estándar de los traductores |
| Encaje aquí | Sin dependencia | Plugin de Vite; para SSR propone un middleware con `AsyncLocalStorage`, que en Workers necesita el indicador `nodejs_compat` (hoy no está); la ficha también puede recibir el idioma como parámetro | Plugin de Babel o SWC; hoy no hay ninguno en la compilación |
| Cuidado | Mantener a mano lo que las librerías ya resuelven | Por defecto cada función lleva todos los idiomas; separar por idioma es opcional | Añade un paso de compilación |

Recomendación: **Paraglide JS**, por claves tipadas y funciones que el empaquetador recorta, lo más cercano a TypeScript estricto y al límite de 161 KB. Antes de decidir, una prueba acotada: pasar un área pequeña (Favoritos) y la ficha SSR, y medir `size` con un segundo idioma de prueba. Si la medida no convence, la opción a mano con la misma forma de catálogo permite cambiar luego sin rehacer las pantallas.

## 4. Orden propuesto

1. **Carpetas por área** (§3.1) con las reglas en `architecture.test.ts`. Solo mueve archivos; un commit por área. Antes de empezar, que no haya ramas abiertas que toquen `client/`.
2. **CSS por área y en capas** (§3.4), con capturas antes y después en móvil y escritorio (debe ser idéntico).
3. **Prueba de Paraglide** (§3.6) y decisión; después, los textos área por área, con una regla en la prueba de consistencia contra texto suelto en JSX.
4. **Fábricas de consultas** (§3.2) y **hooks** (§3.3) cuando se toque cada área.
5. **Catálogo de componentes** (§3.5) cuando convenga.

## 5. Decisiones para Ana

1. ¿Carpetas de área en español y archivos de código en inglés?
2. ¿Se acepta añadir una dependencia de traducción (Paraglide) si la prueba cumple el presupuesto?
3. ¿Hay un idioma y una fecha previstos para la primera traducción? Cambia la prisa del paso 3 y si hace falta el idioma en la URL de la ficha (buscadores).
4. ¿Orden de §4, o primero los textos?

## Resultado del paso 2 (2026-11-23, rama `css-por-areas`)

Hecho §3.4 con los ajustes anotados en `docs/decisiones.md` (2026-11-23): siete capas (`tokens, base, componentes, areas, sin-movimiento, escritorio, encima`), todas las hojas cargadas al arrancar desde `styles/global.css` y los ajustes de Leaflet fuera de capa.

- Hojas: `styles/tokens.css`, `styles/base.css`, `shared/ui/componentes.css`, `shared/ficha.css`, `client/app/marco.css`, `client/comun/comun.css` y una por área (`explorar`, `propietario`, `cuenta`, `admin`). «¿Qué es 3bstays?» sigue llegando con su trozo, ya en capas.
- Reparto: cada regla va a la hoja del área que pone su contexto (la clase más específica de su selector, según qué archivos la usan); lo de `01-base.css` queda en base o componentes. Con un generador (fuera del repositorio) y comprobado con el estilo calculado de 630 estados de la e2e, viejo contra nuevo: cero diferencias tras siete vueltas.
- Pruebas: `read-css.ts` sigue los `@import` con `../` y quita el espacio de alrededor de las llaves; `consistencia.test.ts` mira todo `src/` y solo exime `styles/tokens.css` (los valores propios que antes eximía `01-base.css` entero son excepciones con motivo); `botones.test.tsx` lee `shared/ui/componentes.css`.

## Paso 3 (2026-11-23, rama `textos-catalogos`): catálogos a mano

Ana eligió catálogos a mano tras la prueba de Paraglide, que funcionaba pero dejaba el JS inicial en 161,36 KB, por encima del límite (decisión en `docs/decisiones.md`; la prueba queda en la rama local `prueba-paraglide`). Hechos Favoritos y todo `shared/`, con `plural()` en `domain/plural.ts` y la regla de `consistencia.test.ts`. Forma final: carpeta `copy/` por área, un módulo por pantalla con un export por mensaje e `import * as` (los objetos `as const` pesaban 0,5 KB más en el JS inicial). Después, todas las áreas, un commit por área; la regla vale ya para todos los TSX de `src/`. JS inicial: 159,95 → 160,71 KB.

## Paso 4 (2026-11-23, rama `fabricas-consultas`): fábricas de consultas

Las 38 llamadas a `useQuery` ya usaban fábricas de `queryOptions` (`{ ...xQuery(id), enabled }`); el hallazgo de «28 `useQuery` en línea» quedó resuelto al mover las carpetas. Faltaba que las claves no se copiaran a mano: diez nombres (`listing`, `listing-days`, `listings`, `calendar`, `airbnb`, `own-listing`, `own-listings`, `own-resumable`, `admin-queue` y `offer-taken`) estaban escritos en dos a siete sitios, sobre todo en las invalidaciones de publicar, calendario, Airbnb y suscripción. Ahora cada clave tiene una función (`publicListingKey` y `listingDaysKey` en `shared/listing-query.ts`; `calendarKey` y `airbnbKey` se suman a `client/comun/listing-keys.ts`) y `tests/unit/query-keys.test.ts` falla si un nombre de clave se escribe en más de un sitio. Único cambio de comportamiento: reordenar fotos cancela las lecturas del detalle de esa casa, no las de todas las casas. JS inicial: 160,31 KB.

Los **hooks con propósito** (§3.3) se hacen al tocar cada pantalla grande, una por vez, sin reescritura de golpe.

- **Calendario** (2026-11-23, rama `hooks-calendario`): `calendario.tsx` pasa de 567 a 223 líneas y de 9 efectos a ninguno. `useCalendarHouse` (qué casa: URL, última usada o primera activa; precarga sus días, la recuerda y corrige la URL), `useCalendarDays` (días y guardado optimista: `commit` y `markBooked`), `calendar-months.tsx` (`useScrollToMonth`, `useMonthsNearView`), `calendar-actions.tsx` («Marcar una reserva» y «Pausar la casa» con `useFocusAfterSheet`) y `usePreloadWhenIdle` en `shared/idle.ts`. Sin cambios de comportamiento ni de trozos; JS inicial 160,32 KB.
- **Publicar** (2026-11-23, rama `hooks-publicar`, encima de `hooks-calendario`): `publicar.tsx` pasa de 300 a 215 líneas y de 8 efectos a ninguno. `usePublishEntry` (retomar el borrador pendiente o crear uno y entrar al paso 1, con `useMountedRef`) y, por pantalla, `useStepEnter` (dirección del cambio), `useTrackWizardStep` (evento `wizard_step`) y `useFreshPhotosOnStep` (releer las fotos en el paso 7). `publicar-entrada.tsx` (sin cuenta) se queda igual: sus efectos son dos y cortos. Sin cambios de comportamiento ni de trozos.
- Pendientes: suscripción, propietario, editar y explorar.
