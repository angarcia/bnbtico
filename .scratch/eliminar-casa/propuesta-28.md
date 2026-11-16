# Historia 28 · Eliminar una casa desde Mis casas: propuesta para aprobar

Fecha: 2026-11-16 · Estado: **pendiente de aprobación de Ana**. No hay código. Preparación: Por definir. Diseño: Pendiente (maqueta v0.1 en `maqueta-movil.html`).

## Lo que ya existe y se reutiliza

- **Eliminación lógica** (`listings.deleted_at` + `deleted_reason`, migración `admin_casas_acciones`). Una casa eliminada no la lee nadie por REST, ni su dueño ni el admin; se recupera por SQL.
- **Efectos que ya dependen de `deleted_at`**, sin tocarlos:
  - Explorar, la ficha pública y los favoritos dejan de mostrarla.
  - No admite consultas.
  - El ciclo diario de la suscripción la ignora (`run_subscription_day`).
  - La importación de Airbnb no la vuelve a leer (`programar_importacion_airbnb`).
  - La exportación iCal se invalida (trigger `ical_export_deleted`).
  - La ficha se purga del borde (`purge_listing_page`).
- **Pagos:** en la v1 no hay cobro real. Stripe está en modo de prueba y solo guarda el método de pago (decisión de la fase 5), así que no hay renovación que cancelar en la pasarela.

## Decisiones que necesito (con mi recomendación)

1. **Estados que se pueden eliminar.**
   - Recomiendo: Cambios pedidos, Pendiente de pago, Activa (también pausada por el anfitrión o por 3bstays) e Inactiva.
   - **No:** En revisión, porque el admin podría estar decidiendo; el anfitrión espera la decisión o escribe a 3bstays.
   - **No:** Bloqueada, porque no debe poder borrar la evidencia (`assert_listing_open` ya lo impide).
   - El borrador nunca revisado sigue con «Descartar borrador», que lo borra de verdad.
2. **Suscripción.**
   - Recomiendo: al eliminar se borran los avisos en cola y la casa no se renueva más (ya lo garantiza `deleted_at`).
   - No se reembolsa el período pagado ni se recupera la plaza de la oferta gratuita. La plaza no vuelve a la cola, como hoy con la eliminación del admin.
   - Cuando haya cobro real (después de la v1), cancelar en la pasarela será otra historia, con idempotencia en el webhook.
3. **Sin restauración en la app.** Solo por SQL, como la del admin.
4. **Confirmación: sin motivo y sin escribir el código.**
   - Recomiendo una hoja que nombra la casa y su `CT-####`, explica qué pasa y lleva el botón terracota «Eliminar casa». Es el mismo patrón que «Parar suscripción» y «Descartar borrador».
   - Alternativa, más fricción: escribir el `CT-####` como el admin.
5. **Registro del actor.**
   - `admin_actions.admin_id` es del admin, así que no sirve para el anfitrión.
   - Propongo una columna nueva, `deleted_by uuid`, junto a las que ya existen: `deleted_at` y `deleted_reason = 'Eliminada por el anfitrión.'`, que el `check` de coherencia exige.
   - Admin vería «Eliminada por el anfitrión» frente al motivo del admin.

## Recorrido propuesto (móvil primero)

- **Dónde:** al final del detalle de la casa, como texto terracota centrado «Eliminar casa» bajo la lista. Va en la ficha editable para las publicadas y en el detalle para las no publicadas. Con «Descartar borrador» visible, no se muestra.
  - «Pausar la casa» sigue en el Calendario, con su fecha de vuelta. La diferencia se explica en la hoja: pausar es temporal, eliminar no tiene vuelta.
- **Hoja de confirmación** (texto exacto, a revisar):
  - Título: «¿Eliminar «<nombre>»?»
  - Línea: `CT-#### · <zona>`
  - Cuerpo: «La casa deja de verse en 3bstays, su enlace deja de funcionar y no recibirá más consultas. Su suscripción termina sin reembolso del período ya pagado. Guardamos sus datos por seguridad, pero no podrá recuperarla desde la app. Si solo quiere dejar de recibir clientes un tiempo, use «Pausar la casa» en el Calendario.»
  - Botones: «Eliminar casa» (contorno terracota, grande) y «Cancelar» (fantasma).
- **Estados:**
  - Enviando: el botón dice «Eliminando…» y se desactiva. Sin escritura optimista, porque la acción es irreversible.
  - Éxito: vuelve a Mis casas con el aviso «Casa eliminada.». Si era la última, va a Explorar con la vista de cliente.
  - Error de red: la hoja sigue abierta con «Sin conexión. Revise su internet e intente de nuevo.»; al volver la red se relee la casa.
  - Ya eliminada en otro teléfono, o doble toque: la base responde «No encontramos ese anuncio». La app lo trata como hecho, relee Mis casas y no duplica efectos.
- **Escritorio:** la misma hoja como ventana centrada (`popup`), como «Parar suscripción».

## Backend previsto (cuando se apruebe)

- RPC `delete_own_listing(p_listing uuid)`, con `security definer`.
  - Dueño = `auth.uid()`; `deleted_at is null`; `assert_listing_open`; estados del punto 1.
  - Pone `deleted_at`, `deleted_by` y `deleted_reason`; borra los avisos en cola; purga la ficha.
  - Grant solo a `authenticated`; anónimo y no dueño reciben «No encontramos ese anuncio.» sin modificar nada.
- Contrato `OwnerListingsApi.deleteOwn` en el fake y en PostgREST. Pruebas de la RPC para: dueño, otro anfitrión, anónimo, admin, cada estado, bloqueada, repetición, efecto en Explorar, favoritos, consultas, iCal, Airbnb y suscripción.

## Lo que la maqueta deja por decidir

Textos exactos, si la acción va también en la tarjeta de Mis casas (recomiendo que no: es poco frecuente y destructiva) y el punto 4 (con código o sin él).
