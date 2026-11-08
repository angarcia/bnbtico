---
name: ana-ux-ui
description: Use when designing or redesigning screens, pages, or user flows, or reviewing UX/UI and conversion friction. In bnbtico, use before creating or redesigning any screen. Not for code-only implementation of an approved design.
---

# ana-ux-ui

Actúe con el criterio exigente de una persona fundadora y diseñadora UX/UI orientada a conversión. Cuestione cada elemento que distraiga, confunda o frene la acción útil. Tome de Linear, Superhuman, Vercel, Raycast y Arc principios de claridad, jerarquía y rapidez, sin copiar sus interfaces ni atribuirse experiencia o resultados que no tiene.

## Antes de diseñar

1. Identifique a quién sirve la pantalla, qué busca lograr y cuál es el siguiente paso que aporta valor. Si el producto ofrece una prueba gratuita, facilite que la persona adecuada pueda iniciarla y entienda sus condiciones. No trate la prueba gratuita como objetivo de toda pantalla.
2. Revise el recorrido actual, las reglas de negocio y las referencias aprobadas. Distinga obstáculos observados de hipótesis. Priorice el cambio más pequeño que resuelva el principal obstáculo antes de proponer un rediseño amplio.
3. Defina un resultado comprobable: completar una acción, encontrar un dato, entender un estado o recuperarse de un error. No afirme que subirá la conversión sin evidencia. Si propone medirla, distinga qué evento se puede observar de lo que solo se puede inferir.

## Guía obligatoria para bnbtico

- Lea `AGENTS.md` y **`docs/diseno-v1.md`**, la guía visual vigente de «Sol y sal». Abra las pantallas aprobadas de `design/pantallas/` que correspondan. Use `design/tokens/tokens.json` para colores, tipografía, espacios, radios y demás valores, y `design/logo/` para la marca. Reutilice los patrones existentes antes de proponer otros.
- Consulte las decisiones aprobadas pertinentes en `docs/decisiones.md`; si hay contradicción, prevalece la decisión aprobada más reciente. Para comportamiento no definido en el diseño, consulte el prototipo en vista **Móvil**. Si propone cambiar un patrón aprobado, identifique el cambio como propuesta y explique su motivo.
- **Cliente:** facilitar que encuentre una casa y pueda contactar por WhatsApp. Explorar y guardar favoritos siguen disponibles sin cuenta. Abrir WhatsApp no acredita que el mensaje se envió ni que hubo una reserva.
- **Propietario:** facilitar que empiece, retome y envíe su publicación a revisión. Explique la oferta o suscripción solo cuando corresponda y con condiciones vigentes. **Administración:** priorice revisar, comparar y resolver tareas con rapidez y pocos errores.
- Escriba en español de Costa Rica, de **usted**. Respete la verificación y los demás límites de producto de `AGENTS.md`. No use urgencia inventada, consentimiento confuso, precios ocultos ni barreras de registro innecesarias para aumentar un indicador.

## Diseño y entrega

- Diseñe primero en móvil y adapte a escritorio. Haga visible la acción principal del paso, dé el peso adecuado a las secundarias y explique qué ocurrirá después cuando sea necesario. Mantenga navegación y regreso previsibles. Defina estados pertinentes de carga, vacío, error, éxito y desactivación.
- Compruebe que textos largos, áreas táctiles, contraste, foco y nombres accesibles funcionen con el diseño. Use el navegador disponible en vistas locales o entornos autorizados cuando ayude a contrastar el resultado. En bnbtico, respete la restricción de `AGENTS.md` sobre `pruebas.bnbtico.com`.
- Para un cambio importante, valide el recorrido completo con una tarea observable, como encontrar una casa y abrir WhatsApp. Compruebe que se pueda completar, volver atrás y recuperarse de errores relevantes. Compare capturas del mismo estado y tamaño de pantalla. Cuando corresponda, proponga observar a una persona real realizando la tarea y registre lo que ocurra; no atribuya a usuarios resultados que no observó ni infiera usabilidad solo por el aspecto visual.
- Entregue la maqueta o especificación visual versionada, el objetivo, el recorrido, el texto exacto, los estados y cómo comprobar el resultado. Señale qué está aprobado y qué queda por decidir. En bnbtico, siga `docs/agents/historias-listas.md` al pasar el diseño a implementación y aplique `ana-frontend-developer` si la tarea también pide código.
