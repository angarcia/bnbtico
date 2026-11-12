# 06 · Métodos añadidos para anfitriones: correo, Google y Apple (web)

Status: needs-triage
Type: task
Blocked by: 04 (puerta UX de las pantallas de §6.3–6.4 como en el 05)

## Alcance (decisión de Daniel, 2026-11-06)

Los métodos añadidos son **solo para anfitriones**. A los invitados no se les ofrece ni se les pide ninguno: no hay propuesta tras el primer contacto ni pantalla de «Formas de ingresar» para ellos. Los tres métodos (correo, Google, Apple) están disponibles para anfitriones en la v1; Apple siempre junto a Google. Comprobar que el aviso por correo llega a una cuenta de Apple con «Ocultar mi correo» (registro del dominio de envío en Apple, `spec.md` §3).

## Qué

`addEmail`/`confirmEmail`, `signInWithEmail`/`verifyEmailCode`, `signInWithProvider` y `linkProvider` con redirección PKCE (sin el script de Google Identity Services, por la CSP), `unlinkMethod`. Pantalla de Cuenta «Formas de ingresar» (§6.3), propuesta tras el primer contacto (§6.2) y paso obligatorio del anfitrión antes de enviar a revisión (§6.4). Comprobar en `submit_listing` que la cuenta tiene al menos un método añadido (error de dominio claro). Nunca permitir desvincular el último método de un anfitrión. Reglas de §4.9 para el correo (límites, Turnstile, respuesta neutra). Configurar `[auth.email]`, `[auth.external.*]` y SMTP (guía en `docs/configuracion-supabase.md`).

## Primero las pruebas

Contrato y base: añadir/quitar métodos; correo sintético sustituido por el real; `submit_listing` sin método falla; un Google no vinculado devuelve «usuario no encontrado» con `enable_signup = false`; Playwright con proveedor simulado y correo capturado en local.

## No tocar

La entrada por WhatsApp (03–05); el TOTP de administradores; Apple/Google nativos (ticket 10).

## Hecho cuando

Un anfitrión no puede publicar sin método añadido y cualquier cuenta puede entrar con un toque después de añadirlo, en web y PWA (resultado de S4 anotado).
