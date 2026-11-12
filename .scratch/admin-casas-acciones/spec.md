# Admin · Casas: pausar, bloquear y eliminar

Status: resolved

Decidido con Daniel el 2026-10-30 (al preparar la guía de pruebas nueva: la pestaña «Casas» del admin era solo una lista).

## Reglas

- **Pausar** (algo puntual: fotos engañosas, datos por confirmar): la casa sale de Explorar y su enlace deja de funcionar («Este enlace ya no está activo», como las demás fichas paradas). El propietario la sigue viendo y **editando**; ve «Pausada por bnbtico» y el motivo. No puede reactivarla: la **reanuda el admin**. La suscripción no cambia.
- **Bloquear** (incumplimiento): igual para el público. El propietario ve «Bloqueada por bnbtico» con el motivo y «Escribir a bnbtico» (WhatsApp de propietarios); **no puede editarla ni reactivarla**; la **suscripción se para** (sin cobro ni avisos de oferta/pago mientras dure). Solo el admin la **desbloquea**.
- **Eliminar**: borrado lógico. La casa desaparece para todos, propietario incluido (Mis casas, contadores, pestañas, Calendario, Consultas, favoritos de los clientes, Explorar, sitemap); los datos, fotos y consultas se conservan ocultos en la base. Confirmación escribiendo el código `CT-####`. Sin «deshacer» en la app (se recupera por SQL).
- **Motivo obligatorio** en las tres; el propietario lo ve en Mis casas y en el detalle de la casa. Sin aviso por WhatsApp automático (el admin escribe a mano si hace falta).
- Pausar/bloquear: casas publicadas (Activa, Pendiente de pago, Inactiva). Eliminar: cualquier estado.
- Todo queda en `admin_actions` (acción, admin, motivo). Toda transición es una RPC con `is_admin()` (aal2). La ficha se purga del borde al momento (como al aprobar).

## Diseño técnico sugerido (el constructor decide si hay algo mejor)

- No tocar la máquina de estados de `status`: columnas aparte en `listings`, p. ej. `admin_hold` (`paused` | `blocked` | null), `admin_hold_reason`, `deleted_at`, `deleted_reason`. `listings_public`, Explorar, la ficha (410), el sitemap, favoritos y las vistas del propietario las respetan. `listings_protect` impide editar una bloqueada; nada del propietario toca estas columnas.
- RPCs: `admin_pause_listing`, `admin_resume_listing`, `admin_block_listing`, `admin_unblock_listing`, `admin_delete_listing` (con el `CT-####` de confirmación). Bloquear para la suscripción (sin cobro, sin avisos); desbloquear la deja como estaba antes o la vuelve a activar según las reglas vigentes de la suscripción (documentar en `docs/decisiones.md`).
- `AdminListingsApi`: métodos nuevos en la interfaz, adaptador PostgREST y fake; **suite de contrato** contra los dos, antes de la pantalla.
- Pantalla: en «Casas», tocar una fila abre un detalle admin (hoja o pantalla) con los datos, «Ver ficha pública» y las acciones según el estado («Pausar»/«Reanudar», «Bloquear»/«Desbloquear», «Eliminar casa» en contorno rojo al final). Chips/filtros de la lista incluyen «Pausadas» y «Bloqueadas». Copy en «usted».
