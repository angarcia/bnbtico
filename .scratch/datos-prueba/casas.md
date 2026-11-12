# Casas de prueba en `bnbtico-pruebas`

Sembradas el 2026-10-30 con `sembrar.ts` (ver su cabecera para compilar y ejecutar) por los adaptadores reales de la app; fotos de `fotos/` (no versionadas; créditos en `creditos.md`). Solo hay estas casas: se borraron las demás (CT-1030, 1034, 1036, 1043, 1044, 1045) y sus objetos de Storage.

Cuentas (código `123456`): Yorleny Prueba `8777 0001` (+50687770001), Marco Prueba `8777 0002` (+50687770002), cliente «Cliente Prueba» `8888 1234`, admin Daniel (+17783479837, con segundo factor) y Ana. Las decisiones del admin se hicieron como Daniel con claims aal2.

Los códigos son los de `docs/pruebas-manuales.md`: C = cliente, A = anfitrión, D = admin, X = recorridos.

| CT | Nombre | Dueño | Estado | Zona (provincia) | Fotos | Qué sirve para probar |
|---|---|---|---|---|---|---|
| CT-1040 | Crystal Jungle Villa | Daniel | Activa | Playa Negra (Limón) | 5 | Casa que ya existía; ficha y favoritos (C46–C55, C69–C74) |
| CT-1047 (a) | Casa Cocles frente al mar | Yorleny | Activa | Cocles (Limón) | 8 | Ficha completa con piscina, frente al mar, wifi, aire (C46–C55); filtros de características (C22–C30); consulta con fechas del cliente (C86–C92, A108–A112, X1); favorito; 3 noches ocupadas y una con precio especial (C31–C42, A94–A107) |
| CT-1048 (b) | Cabaña Manzanillo con rancho | Yorleny | Activa | Manzanillo (Limón) | 6 | Acepta mensual con ₡900 000 (C22–C30 «Solo alquiler mensual»); mascotas y Rancho/BBQ; consulta con 30 noches «mensual» (C31–C42, C86–C92) |
| CT-1049 (c) | Loft Puerto Viejo cerca de todo | Yorleny | Activa | Puerto Viejo (Limón) | 4 | Mensual «Precio a negociar con el dueño» (C46–C55); aire, wifi, cargador eléctrico; consulta sin fechas; 0 habitaciones (estudio) |
| CT-1050 (d) | Habitación Playa Chiquita | Marco | Activa | Playa Chiquita (Limón) | 3 | Habitación con baño compartido, ₡25 000 (C4–C9, C46–C55, A21–A26); casa de otro dueño |
| CT-1051 (e) | Habitación privada en Cahuita | Marco | Activa | Cahuita (Limón) | 4 | Habitación con baño privado y «Niños pequeños gratis» (C22–C30) |
| CT-1052 (f) | Villa Punta Uva en la selva | Yorleny | Activa | Punta Uva (Limón) | 8 | 10 personas, ₡180 000, descripción larga de 14 líneas («Ver más», C46–C55); parqueo de pago; noches ocupadas el mes próximo y precios especiales con ★ (C31–C42, A94–A107); consulta de grupo; favorito |
| CT-1053 (g) | Apartamento Limón centro | Marco | Activa | «Barrio Roosevelt» escrita a mano, Otra… (Limón) | 3 | Zona propuesta con la marca del admin (D20–D27); parqueo gratis; búsqueda por Limón (C31–C42) |
| CT-1054 (h) | Casa Playa Negra tranquila | Yorleny | Activa, cerrada hasta 2026-11-20 | Playa Negra (Limón) | 4 | «Cerrar la casa hasta…» (A94–A107): no sale en Explorar pero su ficha abre; debe verse como cerrada a consultas (C56–C63, C86–C92); favorito |
| CT-1055 (i) | Casa Santa Teresa cerca del mar | Marco | Activa | Santa Teresa, Otra… (Puntarenas) | 5 | Otra provincia: Explorar solo ofrece Puntarenas si hay casa aprobada allí (C22–C30, C31–C42) |
| CT-1056 (j) | Casa Jaguar Puerto Viejo | Yorleny | Activa con oferta de lanzamiento (12 meses) | Puerto Viejo (Limón) | 5 | Para el reloj de pruebas (A124–A139, X6): cambiar sus días de oferta; no tocarla en otras pruebas |
| CT-1057 (k) | Cabina Hone Creek | Yorleny | Borrador incompleto | Hone Creek (Limón) | 0 | Sin fotos ni precio: «Falta: fotos y precio», «Seguir publicando» (A57–A65, A42–A49) |
| CT-1058 (l) | Cabaña Hone Creek con jardín | Yorleny | En revisión | Hone Creek (Limón) | 5 | Aprobar casa nueva (D28–D44, X1) |
| CT-1059 (m) | Casa Playa Bite con hamaca | Yorleny | En revisión | Playa Bite (Limón) | 3 | Pedir cambios y rechazar (D28–D44, X2) |
| CT-1060 (n) | Cabina Playa Grande Cahuita | Yorleny | Cambios pedidos | Playa Grande (Limón) | 4 | Nota «Necesitamos una foto del baño.»; «Corregir y reenviar» (A66–A76, X2) |
| CT-1061 (o) | Casa Siquirres vista al río | Yorleny | Rechazada | Siquirres (Limón) | 3 | Nota «Las fotos no corresponden a la casa.»; sin reenviar (A66–A76) |
| CT-1062 (p) | Casa Playa Chiquita jardín | Yorleny | Pendiente de pago | Playa Chiquita (Limón) | 4 | Oferta terminada (reloj en -1): «Añadir método de pago» con Stripe de prueba (A113–A139, X6); su enlace público no funciona (C64–C68) |
| CT-1063 (q) | Cabaña Pocora junto al río | Yorleny | Inactiva | Pocora (Limón) | 3 | Suscripción parada por la propietaria; «Reactivar» (A113–A123); enlace parado (C64–C68) |
| CT-1064 (r) | Casa Cocles con terraza | Marco | Activa, pausada por el admin | Cocles (Limón) | 4 | Pausa «Confirme que las fotos son de esta casa.»; el dueño la sigue editando (D58–D78, A66–A76); no sale al público |
| CT-1065 (s) | Casa Guápiles con piscina | Yorleny | Activa, bloqueada por el admin | Guápiles (Limón) | 3 | Bloqueo «Publica un teléfono dentro de las fotos.»; dueño sin editar, enlace 410 (D58–D78, C64–C68) |
| CT-1066 (t) | Casa Punta Uva bambú | Yorleny | Activa con cambios pendientes | Punta Uva (Limón) | 4 (+1 nueva) | Nombre y descripción enviados a revisión («Casa Punta Uva Bambú Lodge») más 1 foto nueva: aprobar y pedir cambios dato a dato (D45–D57, A81–A93) |

Consultas del cliente `8888 1234` (pestaña «Consultas» de Yorleny, A108–A112): a CT-1047 (19 al 22 de noviembre, 3 personas), CT-1048 (29 de noviembre al 29 de diciembre, 30 noches, 2 personas), CT-1052 (14 al 18 de diciembre, 8 personas) y CT-1049 (sin fechas). Favoritos del cliente: CT-1047, CT-1052, CT-1054.

Límites a tener en cuenta: Yorleny tiene 1 borrador (CT-1057) de los 5 permitidos. Las 15 casas aprobadas llevan oferta de lanzamiento 12 meses (plazas 5 a 19; CT-1040 tiene la 4), salvo CT-1062 (oferta terminada a propósito). El contador «quedan N de 50 plazas» baja en consecuencia.
