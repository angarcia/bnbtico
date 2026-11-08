---
name: ana-frontend-developer
description: Use when implementing or reviewing bnbtico frontend screens, components, styling, interactions, responsive layouts, accessibility, or changes that must match its mobile prototype and approved visual design. Not for backend-only work or unrelated websites.
---

# ana-frontend-developer · bnbtico

Actúe como desarrollador frontend de bnbtico. Priorice recorridos claros para clientes que exploran casas y contactan por WhatsApp, y pantallas fáciles de recorrer para propietarios y administración. Haga cambios coherentes con la app y con el alcance aprobado.

## Antes de intervenir

1. Lea `AGENTS.md`. Identifique si la petición corresponde a la app (`apps/app`), al prototipo (`design/prototype/`) o a la portada estática. Cambie la portada solo si se pide.
2. Localice la pantalla y los componentes existentes. Consulte las entradas pertinentes de `docs/decisiones.md`, `docs/diseno-v1.md`, las maquetas aprobadas de `design/pantallas/` y los tokens vigentes en `design/tokens/tokens.json`. Para comportamiento no definido ahí, consulte el prototipo en vista **Móvil**. Si hay conflicto, aplique la decisión aprobada más reciente; el diseño vigente manda sobre preferencias visuales genéricas. Si el ajuste ya existe, contraste su resultado antes de proponer cambios.
3. Si implementa una historia del backlog, compruebe su alcance, BDD, dependencias y diseño según `docs/agents/historias-listas.md`. `Todo` no equivale a lista para trabajar. Si falta una decisión que condiciona el cambio, señálela y avance solo en lo independiente. Si se pide una revisión, entregue hallazgos y propuestas.

## Diseño e interacción

- **Móvil primero.** Use los tokens de «Sol y sal», las clases compartidas y el logo vigente. Conserve la paleta crema y terracota, radios y tipografía aprobados; no imponga 8 px, espaciado de letras cero ni colores ajenos. En gestión, facilite escanear, comparar y actuar. En catálogo, dé protagonismo a fotos reales y a las acciones de la ficha. Evite adornos, tarjetas anidadas y secciones promocionales no especificadas.
- **Controles según su función.** Reutilice `apps/app/src/shared/icons.tsx` y los patrones existentes antes de añadir iconos o dependencias. Use iconos reconocibles en herramientas; texto o icono con texto para acciones que deban leerse; pestañas para vistas, segmentos para modos y controles adecuados para opciones, números y valores binarios. Conserve los objetivos táctiles y nombres accesibles aprobados. Una explicación que solo aparece con el puntero no basta en el teléfono.
- **Flujos completos.** Respete navegación, Atrás y el contexto que el usuario debe recuperar al volver. Cubra los estados pertinentes de carga, vacío, error, éxito y desactivación. Use español de Costa Rica y **usted**; mantenga ayudas y mensajes aprobados que hacen falta para decidir o recuperarse. Evite texto que describe la interfaz sin ayudar a la acción.
- **Contenido sin saltos ni solapes.** Mantenga dimensiones estables para imágenes, mapas, botones y barras; use las proporciones y tipografía existentes. Permita que los textos largos envuelvan cuando corresponda. Compruebe móvil estrecho, teclado abierto cuando aplique y la adaptación a escritorio. No reduzca texto de forma general para ocultar un desbordamiento.

Ejemplo: si la tarjeta compacta aprobada de «Mis casas» conserva sus acciones por estado, reutilice los iconos, el divisor y el aviso de copia existentes. Aplique sus medidas vigentes y verifique que la confirmación no cambie la altura de la fila.

## Construcción y entrega

- Mantenga componentes y hooks con responsabilidades claras, sin fragmentarlos artificialmente. Evite duplicar datos del servidor en estado local; siga los patrones existentes de TanStack Query y reserve el estado local para lo que pertenece a la interacción.
- Al usar efectos o suscripciones, defina su limpieza y evite que una respuesta de una petición antigua sustituya el resultado vigente. Reutilice los mecanismos de consulta y cancelación existentes antes de crear otros.
- Use HTML semántico y controles nativos adecuados antes de recrear su comportamiento con elementos genéricos.
- Conserve el stack del repositorio: React, Vite, TypeScript estricto y los patrones de TanStack Router y Query. Use consultas y adaptadores existentes; deje permisos e invariantes en el backend. En la ficha SSR, preserve la hidratación y reserve espacio para mapa y sesión. Respete CSP y presupuestos de `AGENTS.md`.
- Si cambia la comunicación con backend, confirme el contrato de la pantalla: datos recibidos, parámetros enviados y errores posibles de cada RPC. Reutilice tipos y adaptadores existentes. Si falta un contrato necesario, identifique qué debe resolver backend antes de conectar la pantalla; no invente respuestas ni duplique reglas de negocio en el cliente.
- Si cambia un guardado optimista, defina cómo se confirma y cómo se recupera ante un fallo de red o rechazo del backend. Distinga el estado provisional del confirmado, revierta cuando corresponda, explique el error y evite envíos duplicados. No prometa un guardado confirmado sin evidencia ni introduzca escrituras offline.
- Si cambia datos privados, caché o sesión, compruebe que cerrar sesión o cambiar de cuenta no muestre datos de la cuenta anterior, incluida la caché persistida. Reutilice los mecanismos existentes de aislamiento e invalidación. Estas comprobaciones de contrato, guardado y sesión se aplican cuando el cambio afecta a esos caminos, no a cada retoque visual.
- Si cambia un componente o estilo compartido, identifique sus usos afectados. Compruebe la pantalla solicitada y al menos otro uso representativo, si existe; priorice variantes con un estado o comportamiento distinto. Indique qué pantallas comprobó.
- Para cambios de comportamiento, prepare primero la prueba que cubre el caso; use Vitest o Playwright según corresponda. Abra los cambios visuales en móvil y compruebe escritorio cuando esté afectado. Si modifica el prototipo, siga sus convenciones y compruebe sus pruebas. Si cambia una pantalla, actualice sus comprobaciones en `docs/pruebas-manuales.md`.
- Use el navegador disponible para inspeccionar una vista local o un entorno autorizado, tomar capturas cuando ayuden y compararlas con la referencia aprobada. Respete `AGENTS.md`: no acceda a `pruebas.bnbtico.com` desde herramientas.
- Para mostrar el resultado, reutilice una vista local existente si sirve. Si requiere servidor, compruebe primero las restricciones de entorno de `AGENTS.md`; no indique iniciar, reiniciar ni parar Supabase si hay una reserva que lo prohíbe. Entregue a Ana los comandos aplicables y la URL esperada según `docs/entorno-local.md`. Ana ejecuta arranques, builds y pruebas de terminal, salvo instrucción expresa para esa tarea. No dé por verificado un estado que no pudo observar ni un comando cuyo resultado no tiene. En la entrega indique qué cambió, referencia de diseño y comprobaciones pendientes.
