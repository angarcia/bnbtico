# 07 · Prueba de acceso reciente en las acciones sensibles

Status: needs-triage
Type: task
Blocked by: 06

## Qué

Llamar a `require_recent_auth()` dentro de las RPC de: cambiar WhatsApp de contacto (crear y aplicar el reto `change_phone`), cambiar correo, vincular/desvincular métodos, borrar cuenta (si existe; si no, dejar la RPC lista y anotarlo), y añadir/cambiar el método de pago (también en `/api/pago/sesion`, comprobando el claim del JWT en el worker). `reauthenticate(...)` en la `AuthApi` y la hoja «Confirme que es usted» (§6.5). Flujo de cambio de número (§5.4) completo.

## Primero las pruebas

Base: JWT con y sin sello reciente; ventana de 10 min; el refresco no renueva el sello (según S2). Contrato: cada método de reautenticación renueva la prueba. Playwright: cambio de número con y sin prueba reciente; pausar o cerrar una casa **no** pide nada.

## No tocar

Las acciones rutinarias del anfitrión (editar descripción, calendario, Actividad, pausar casa); `aal2` de administradores.

## Hecho cuando

Un token robado sin el método añadido no puede cambiar nada de la lista, comprobado en SQL.
