# Ajuste compacto de Mis casas · Implementation Plan

> **For agentic workers:** usar superpowers:executing-plans en este chat, con la ejecución de comandos por Ana.

**Goal:** aplicar la propuesta compacta aceptada con divisor neutro y conservar la barra de estados original.
**Architecture:** cambios locales en la tarjeta de Mis casas y su CSS; se conservan el componente de foto, el botón de compartir y todas las rutas y reglas.
**Tech Stack:** React 19, TypeScript, CSS existente y Playwright.
**Spec:** [captura final](./evidencias/implementacion/07-mis-casas-divisor-neutro-final.png) y correcciones de Ana en este chat del 2026-11-06: divisor sin franja verde; barra de estados como estaba; márgenes iguales entre barra y tarjetas.

## Acuerdo y alternativas

Aumentar solo los iconos se descartó por exceso de espacio. La captura compacta se acepta con una línea neutra en lugar de la banda verde. La cabecera de recuento plano se descarta: se mantienen sus casillas, colores, enlaces y cantidades actuales. Se conservan las fotos y los estados; tarjetas y barra comparten el margen lateral de 16 px. Calendario/Consultas pasan a 28 px dentro de objetivos de 44 px, separados 16 px. Nombre y zona se acercan. Compartir queda como icono y texto verde sobre la superficie de la tarjeta; el cambio se limita a Mis casas.

## Global Constraints

- Sin dependencias, cambios de datos ni reglas nuevas; UI en español de usted.
- Mantener compartir/copiar sin saltos de tamaño, rutas por casa, contador y restricciones.
- Mantener borradores, notas, pagos dorados y barra inferior.
- Ana ejecuta typecheck, build y pruebas; commit por bloque probado.

## Review Focus

- Una casa: conserva Compartir y oculta las herramientas por casa (prueba existente de Navegación).
- Varias casas: alineación de barra/tarjetas y accesos sin solapamiento en 375/390 px (prueba existente de Propietario).
- Copiar enlace: tamaño estable con «Enlace copiado» (prueba existente de Propietario).
- Estados de pago y bloqueos: conserva acciones y contenido completos (suite Estados de suscripción).
- Nombres largos, nota de pausa y móvil de 320 px: verificar disposición en navegador; conservar saltos de línea.

## Tarea única

**Files:** propietario.tsx; 05-cuenta-propietario.css; tests/e2e/propietario.spec.ts; docs/diseno-v1.md; docs/decisiones.md; docs/pruebas-manuales.md; registro de ejecución de esta carpeta.
**Interfaces:** se conservan OwnerCard, ShareButtonInline y sus props; sin interfaces nuevas.

- [x] Ampliar la prueba móvil existente con alineación de bordes y dibujo de los iconos; conservar las pruebas de rutas y estabilidad al copiar.
- [x] Ajustar únicamente márgenes y compactación de tarjetas con acciones; no cambiar la barra de estados.
- [x] Revisar en navegador el divisor neutro, las tarjetas y la barra original en móvil, sin modificar datos de casas.
- [x] E2E ejecutadas por Ana: 34 pasadas en Navegación/Estados de suscripción y 11 pasadas en la repetición completa de Propietario.
- [ ] Resultado explícito de typecheck y build no comunicado en este chat.
- [ ] Preparar staging propio y entregar commit/push a Ana tras su resultado.
