# 13 · «Rechazar» en la revisión dato a dato

Status: ready-for-agent (después del 10; Daniel, 2026-11-03)

Hoy, ante un cambio pendiente de una casa publicada, el admin solo puede «Aprobar» o «Pedir cambios» (con nota; el cambio sigue siendo del anfitrión para corregirlo). Decisión 2026-10-29: «Sin "Rechazar" para una edición». Daniel la cambia:

- Tercera opción **«Rechazar»** por dato (y por foto nueva) con **nota obligatoria**. Al rechazar, el cambio pendiente se **descarta**, la ficha sigue con el dato aprobado y el **anfitrión ve la nota** donde hoy ve la de «Pedir cambios» («Rechazado: <nota>»), hasta que vuelva a editar ese dato o la cierre.
- «Aprobar» y «Pedir cambios» no cambian.
- Se registra en `admin_actions`.
- Botón «Avisar a <anfitrión> por WhatsApp» como en las demás decisiones (manual, sin envío automático).

## No tocar
- Flujo de «Aprobar» y «Pedir cambios», cola de revisión, purga.
- Lo del ticket 10 (Ana edita).
