// Catálogo de componentes (/_componentes, solo local y pruebas; trozo diferido componentes-*). Catálogo de textos
// (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio de nombres
// (`import * as X_COPY`). Son textos de muestra: lo que se revisa aquí es el aspecto de cada pieza.

export const title = "Componentes";
export const intro = "Cada componente común de shared/ui en sus variantes y estados. Solo existe en local y en pruebas.";
export const buttons = "Botones";
export const buttonVariant = ({ variant, size }: { variant: string; size: string }) => `${variant} · ${size}`;
export const pending = "Guardando…";
export const disabled = "Desactivado";
export const block = "A todo el ancho";
export const textButtons = "Botones de texto";
export const textButton = ({ tone }: { tone: string }) => `Enlace ${tone}`;
export const iconButton = ({ tone }: { tone: string }) => `Cerrar (${tone})`;
export const cards = "Tarjetas";
export const cardTone = ({ tone }: { tone: string }) => `Tarjeta ${tone}`;
export const cardBody = "Texto de la tarjeta, con una segunda línea para ver el interlineado.";
export const cardRow = "Tarjeta en fila";
export const tags = "Etiquetas y contadores";
export const notices = "Avisos";
export const notice = ({ tone }: { tone: string }) => `Aviso ${tone}: algo que conviene saber antes de seguir.`;
export const noticeAction = "Revisar";
export const emptyTitle = "Todavía no hay nada aquí";
export const emptyText = "Cuando haya algo, aparecerá en esta lista.";
export const emptyAction = "Empezar";
export const skeletons = "Esqueletos";
export const skeleton = ({ shape }: { shape: string }) => `Cargando (${shape})`;
export const fields = "Campos";
export const name = "Nombre";
export const namePlaceholder = "Casa Coral";
export const nameHint = "El que verán los clientes.";
export const price = "Precio por noche";
export const priceError = "Escriba un precio mayor que cero.";
export const description = "Descripción";
export const descriptionCount = "120 / 2000";
export const province = "Provincia";
export const provinces = ["Limón", "Puntarenas", "Guanacaste"] as const;
export const search = "Buscar una zona";
export const checkbox = "Acepto que me escriban por WhatsApp";
export const choices = "Elecciones";
export const chips = "Características";
export const chipOptions = [
  { value: "pool", label: "Piscina" },
  { value: "pets", label: "Mascotas" },
  { value: "wifi", label: "Wifi" },
  { value: "parking", label: "Parqueo" },
] as const;
export const segmented = "Moneda";
export const segmentOptions = [
  { value: "crc", label: "₡", name: "Colones" },
  { value: "usd", label: "$", name: "Dólares" },
] as const;
export const counters = "Contadores";
export const people = "Personas";
export const bedrooms = "Dormitorios";
export const closedFields = "Campos cerrados";
export const where = "¿Dónde?";
export const whereValue = "Cahuita, Limón";
export const house = "Casa Coral";
export const checkIn = "Llegada";
export const checkInValue = "8 nov";
export const checkOut = "Salida";
export const checkOutEmpty = "Elegir fecha";
export const datesInSheet = "Las casillas de fecha solo viven en la hoja de contacto: ábralas con «Abrir hoja».";
export const surfaces = "Hojas y ventanas";
export const openSheet = "Abrir hoja";
export const openDialog = "Abrir ventana";
export const sheetTitle = "Hoja de muestra";
export const dialogTitle = "Ventana de muestra";
export const surfaceBody = "Se cierra con la X, con Escape o tocando fuera.";
export const close = "Cerrar";
export const icons = "Iconos";
