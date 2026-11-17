# Textos para GitHub (épica #22 y sus tickets)

Preparados el 2026-11-09 y rehechos el 2026-11-17; el token de `gh` de esta máquina es de solo lectura, así que los publica una persona. Borrar este archivo cuando estén publicados.

Resumen: #22 pasa a apuntar al rediseño; #23 y #24 siguen (con criterios añadidos); #25 se cierra como no planificada; #26 sigue en V1.1 con una pregunta añadida.

## #22 · Cuerpo nuevo de la épica (sustituye al actual)

````markdown
<!-- bnbtico-import:acceso-epica -->

Status: needs-triage
Versión propuesta: Transversal

## Objetivo

Permitir que una persona nueva entre a bnbtico con lo mínimo y que vuelva con el menor esfuerzo y el menor coste posible, sin contraseñas.

## Alcance y contexto

**Actualización 2026-11-09.** La épica se amplió con el rediseño del ingreso (`.scratch/login-rediseno/spec.md`, con su glosario en `CONTEXT.md` y diez tickets propios). El rediseño sustituye el código por WhatsApp enviado por bnbtico por un **código inverso**: la persona envía un código a bnbtico y el webhook crea o reconoce la cuenta, inicia la sesión y verifica el número en un solo paso. Reduce unas 13 veces el coste de cada verificación. Anfitriones: método añadido obligatorio al publicar. Invitados: nunca se les pide. Sesión de ~1 año. Passkeys en V1.1.

Qué queda de esta épica:
- **#23 y #24** siguen vigentes: la investigación y la corrección de la sesión no dependen del diseño y la sesión larga del rediseño las necesita.
- **#25** se cierra como no planificada: validaba el flujo actual (país, número y código), que el rediseño elimina. Sus criterios pasan a las pruebas de los tickets del rediseño.
- **#26** sigue en V1.1; la evaluación debe decidir también si una passkey puede sustituir al método añadido de los anfitriones.

Se conserva: explorar y favoritos sin cuenta, WhatsApp verificado para publicar y contactar, TOTP del administrador. Pendiente de aprobación de Daniel y Ana, y de la revisión de UX de las pantallas antes de implementar.

## Criterios BDD

**Escenario 1**

**Dado** una persona nueva,
**Cuando** inicia el ingreso,
**Entonces** solo envía un mensaje de WhatsApp a bnbtico (y su nombre, la primera vez que contacta), sin contraseña, passkey ni correo.

**Escenario 2**

**Dado** una sesión renovable válida,
**Cuando** la persona vuelve al mismo navegador,
**Entonces** continúa sin repetir el código.

**Escenario 3**

**Dado** una sesión perdida,
**Cuando** la persona es anfitriona con un método añadido, o invitada,
**Entonces** el anfitrión entra con su método añadido y el invitado repite el código inverso.

## Evidencia para cerrar

Aceptar las subhistorias vigentes; documentar qué es capacidad existente, fallo reproducido y función nueva. No prometer que nunca se solicitará autenticación otra vez.

## Fuera de alcance

No cambios en reservas/pagos, no identidad Veriff, no sustitución del segundo factor administrativo.

## Regla para agentes

Todo no significa lista para trabajar. Leer `docs/agents/historias-listas.md` del repositorio.
Antes de implementar: dependencias resueltas con resultado habilitante; decisiones de negocio aprobadas; criterios BDD verificables; y, si cambia UI, diseño enlazado y aprobado por Ana, con el campo Diseño en Listo. Un enlace a una tarea de diseño pendiente no satisface ese requisito. Cerrar una dependencia como rechazada o wontfix no habilita automáticamente su implementación.
Las investigaciones se ejecutan solo dentro de su alcance de lectura/análisis. Crear esta tarjeta no autoriza despliegues, proveedores, cargos, migraciones ni cambios de entorno.

## Referencias

- [Sesiones de Supabase](https://supabase.com/docs/guides/auth/sessions)
- [Passkeys de Supabase (experimental)](https://supabase.com/docs/guides/auth/passkeys)
````

## #23 · Comentario

> Actualización 2026-11-09: sigue vigente y no depende del rediseño. Debe cubrir además la PWA instalada en iOS y registrar si algún cierre de sesión se debe a un fallo de renovación o a revocación (contexto: el rediseño usa sesiones de ~1 año). Ver épica #22.

## #24 · Sección que se añade al final del cuerpo actual

````markdown
## Actualización 2026-11-09 (rediseño del ingreso)

El rediseño prevé sesiones de ~1 año, así que perderlas por un defecto de renovación sale más caro. Criterios añadidos:

- Un fallo temporal de red o de almacenamiento al renovar no cierra la sesión ni pierde el borrador (publicación o contacto en curso).
- El estado de sesión distingue «renovación fallida por red» de «sesión revocada».
- Documentar si el cierre de sesión revoca solo el dispositivo o todos (hoy es global); decidir con el rediseño.
````

## #25 · Comentario y cierre como «no planificada»

> Se cierra como no planificada (2026-11-09): valida el flujo actual (país, número y código), que el rediseño del ingreso sustituye por el código inverso. Los criterios (alta mínima, retorno al borrador o a la consulta, explorar y favoritos sin cuenta) pasan a las pruebas del rediseño (`.scratch/login-rediseno/`, tickets 04 y 05). Ver la épica #22.

## #26 · Comentario

> Sin cambios de versión (V1.1). Con el rediseño del ingreso (épica #22), la evaluación debe responder además: ¿puede una passkey sustituir al método añadido de los anfitriones, y funciona en la app Capacitor y en la PWA instalada? Las cuentas tendrán un correo interno sintético hasta que el anfitrión añada uno real.
