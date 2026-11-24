# Petición a IT: exclusiones de Microsoft Defender para pruebas de desarrollo

Borrador para que Daniel o Ana lo envíen a IT (2026-11-24). No se ha enviado.

---

**Asunto:** Exclusiones de análisis en tiempo real de Microsoft Defender para carpetas de desarrollo (macOS)

Hola:

En mi Mac trabajo con un proyecto web cuyas pruebas automáticas escriben y vuelven a leer miles de archivos temporales
(informes de pruebas, compilaciones y perfiles de navegador). La protección en tiempo real de Microsoft Defender analiza
cada uno al abrirlo y eso hace las pruebas mucho más lentas que en nuestro servidor de integración continua:

- Abrir un archivo JSON de prueba de 260 KB recién escrito tarda unos 13 segundos en este equipo; uno del mismo tamaño
  con otro contenido abre en 4 milisegundos, y la misma prueba tarda 0,4 segundos en el servidor de CI (Linux).
- La batería completa de pruebas de navegador tarda unos 16 minutos y algunas pruebas fallan por tiempo de espera.

¿Se podrían excluir del análisis en tiempo real (manteniendo los análisis programados, si hace falta) estas rutas?

1. La carpeta del proyecto: `/Users/daguadomunoz/tmp_worskpace/casa-tica`
2. La carpeta temporal del usuario: `/var/folders/cs/cv5r68qd147_54r2xq8gr6840000gp/T`
3. Los navegadores de pruebas de Playwright: `/Users/daguadomunoz/Library/Caches/ms-playwright`

Si excluir la carpeta temporal entera no es posible, bastaría con las otras dos y con los procesos `node` que lanzan las
pruebas. El código del proyecto es nuestro y está en un repositorio privado de GitHub; no se descargan ni ejecutan
archivos de terceros fuera de las dependencias habituales de npm.

Gracias.

---

**Cómo comprobar después que ha surtido efecto** (en la carpeta `apps/app`):

```bash
pnpm exec vitest run tests/unit/playwright-artifacts.test.ts -t "limita la cantidad de nodos" --reporter=verbose
```

Hoy tarda unos 13 s; sin el análisis debería quedar por debajo de 1 s, como en CI.
