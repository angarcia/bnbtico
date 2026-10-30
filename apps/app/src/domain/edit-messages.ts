// Mensajes de la edición de una casa publicada, idénticos en SQL, el dominio y el fake. Van aparte de ./edit para que los
// adaptadores de datos (en el JS inicial a través del del admin) no arrastren las reglas del formulario.
// Módulo de dominio: sin imports de framework.
import { MAX_PHOTOS } from "./listing";

export const EDIT_MESSAGES = {
  notHere: "Ese dato no se puede cambiar aquí.",
  notPublished: "Solo puede cambiar así una casa publicada.",
  decided: "Esta edición ya tiene una decisión.",
  notFound: "No encontramos esa edición.",
  photoNotFound: "No encontramos esa foto.",
  changed: "La edición cambió. Vuelva a abrirla.",
  noteRequired: "Escriba una nota para pedir cambios.",
  lastPhoto: "Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.",
  newPhotosReviewed: "Las fotos nuevas pasan por revisión. Añádalas desde la ficha de su casa.",
  frozen: "Esta casa está publicada: cambie sus datos desde Mis casas.",
  maxPhotos: `Máximo ${MAX_PHOTOS} fotos.`,
} as const;
