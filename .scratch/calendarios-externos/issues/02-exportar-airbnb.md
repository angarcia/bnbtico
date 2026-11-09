# #6 · Exportar disponibilidad de bnbtico hacia Airbnb

Status: ready-for-agent
Preparación: Lista para trabajar. Ana aceptó #5 y pidió continuar con #6 tras fusionar la PR #30; diseño móvil v0.1 y P1/P4/P5 aprobados. Contrato técnico: `../contrato-tecnico-06.md`; ejecución y comprobaciones pendientes en `../plan-06.md`. No se modifica el estado de GitHub desde este archivo.
Fuente: https://github.com/angarcia/bnbtico/issues/6 · Épica: #4.

## Objetivo y capacidad existente

El anfitrión lleva a Airbnb las noches que marcó en bnbtico. Existen bloqueos manuales; no feed ni token por casa. Reutilizar el manual y la separación preparada en #5.

## Alcance y exclusiones

Generar, copiar y consultar un enlace exclusivo de solo lectura, sin sesión, con instrucciones verificadas para importarlo en Airbnb. Exportar únicamente manuales dentro de ventana y con fin exclusivo. Sin consultas WhatsApp, importados solos, precios, datos de huéspedes, otras plataformas ni promesa de lectura inmediata. La revocación visible corresponde a #7, pero el modelo debe permitirla desde el inicio.

## Condiciones de entrada y diseño

#5 probada y aceptada por orden de Ana; diseño móvil [v0.1](../diseno-v0.1.md), Exportar, aprobado; P1/P4/P5 resueltas. Escritorio aplazado, sin bloquear esta entrega. Definir token no enumerable, lectura pública limitada al feed, generación restringida al dueño y ausencia de secretos en logs. Criterio de caché que permita invalidación efectiva posterior. Validar instrucciones de Airbnb sin inventar rutas de menú.

## BDD

- **Dado** un dueño habilitado sin enlace, **cuando** genera y copia, **entonces** obtiene un enlace de esa casa y «Enlace copiado» solo si la copia fue correcta.
- **Dado** bloqueo manual 10, 11 y 12, **cuando** se lee el feed sin sesión, **entonces** representa esas noches con salida exclusiva 13.
- **Dada** noche ocupada solo por Airbnb, **cuando** se exporta, **entonces** no se incluye; si también tiene manual, se exporta este una sola vez.
- **Dado** bloqueo manual exportado, **cuando** se libera y se vuelve a consultar, **entonces** desaparece del feed aunque la noche siga ocupada por Airbnb en bnbtico.
- **Dada** consulta registrada por WhatsApp, **cuando** se genera el feed, **entonces** no crea ningún bloqueo.
- **Dado** un feed sin manuales, **cuando** se consulta, **entonces** es un calendario válido vacío, sin datos personales ni precios.
- **Dado** portapapeles denegado, **cuando** intenta copiar, **entonces** no muestra éxito y permite copiar manualmente el enlace.
- **Dado** otro propietario o token inválido, **cuando** intenta generar o leer respectivamente, **entonces** no recibe acceso a otra casa; la URL no permite editar.

## Validación y skills necesarias

[Plan manual](../pruebas-manuales.md), E y R; parsear el feed generado con lector independiente, comprobar semántica, privacidad, fronteras y ausencia de ciclos. Prueba real de importación en alojamiento Airbnb de prueba cuando Ana disponga de él; si falta, declarar pendiente esa integración externa.

Principal `ana-backend-developer` para feed, token y permisos; apoyo `ana-frontend-developer` para generación/copia/errores aprobados. `ana-ux-ui` solo si hay desviación. Documentar feed e instrucciones y actualizar pruebas manuales al entregar. No comenzar #7 hasta aceptar #6.
