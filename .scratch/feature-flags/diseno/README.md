# Diseño #59 · feature flags · v1 (2026-11-17) — **aprobado por Ana el 2026-11-17** (`docs/decisiones.md`, «Diseño del número de noches y de los estados de las flags»)

Maquetas HTML con el CSS real de la app (`app.css`, copia del build de `flags-base`) y capturas en `capturas/` (móvil 375 px, laptop 1280 px). Regla: cambio mínimo sobre `docs/diseno-v1.md`, reutilizando patrones existentes.

## Número de noches (implementación: historia nueva `flags-noches`)

| Pantalla | Cambio | Maqueta |
| --- | --- | --- |
| Buscar (móvil) | «¿Cuándo?» → **«¿Cuántas noches?»**: contador de «¿Quiénes?» (1–90, «De 1 a 90») y atajos «Fin de semana» (2), «1 semana» (7), «2 semanas» (14), «1 mes» (30). Nota: «Le mostramos un precio orientativo para esas noches. La disponibilidad se la confirma el anfitrión por WhatsApp.» Cerrado: «Añadir noches» / «4 noches». | `01-movil-buscar-noches.html` |
| Explorar (móvil) | Píldora «4 noches · 2 personas»; línea «8 casas · 4 noches» y debajo «Precios orientativos con el precio por noche. El anfitrión le confirma por WhatsApp si está libre.»; tarjeta y mapa «≈ ₡180 000 por 4 noches» (la etiqueta del modo fechas). | `02-movil-explorar-noches.html` |
| Explorar (laptop) | El campo «Fechas» pasa a «Noches» (icono luna): panel con el mismo contador, atajos, «Quitar noches» y «Aplicar noches». Personas no cambia. | `03-laptop-explorar-noches.html` |

Estados: vacío = «Añadir noches», sin total (precio por noche); válido = total en tarjetas y mapa; inválido solo puede llegar por URL (`?noches=0`, `91`, `abc`): se ignora sin aviso, como `?prov=`. Los botones − y + se desactivan en 1 y 90. Lector de pantalla: «Una noche menos», «Una noche más», la cifra con `aria-live`.
Reglas ya aprobadas: 1–90; ≥ 30 noches con precio al mes → mes × noches / 30; filtro de precio por noche; las noches ocupadas no excluyen casas.

## Estados para #60–#62 (sin maqueta nueva: quitan o recuperan elementos existentes)

- **#60 fechas encendida:** el diseño vigente de «¿Cuándo?» (diseño v1). Con fechas y noches encendidas, mandan las fechas y no aparece «¿Cuántas noches?». Con las dos apagadas, ni «¿Cuándo?» ni «¿Cuántas noches?»: tarjetas con precio por noche. Enlaces con `llegada`/`salida` y la flag apagada: se ignoran, sin filtro oculto.
- **#61 precios por fecha apagada:** el calendario del anfitrión pierde la acción de cambiar el precio de un día y la ★ de las casillas; la ficha y los totales usan solo el precio por noche. Bloquear y desbloquear noches no cambia.
- **#62 habitaciones apagada:** Publicar y Editar dejan de preguntar el tipo (toda casa es Alojamiento completo, sin pregunta de baño compartido); Filtros pierde la sección «Tipo de alojamiento». `?tipo=habitacion` se ignora.
- **#63 (prioridad baja) iCal apagada:** desaparece la fila «Airbnb» y la exportación del calendario.

## Aprobado además
Noches en la URL (`?noches=4`); WhatsApp sin fechas dice «para 4 noches»; sin aviso al anfitrión por los precios por fecha ocultos.
