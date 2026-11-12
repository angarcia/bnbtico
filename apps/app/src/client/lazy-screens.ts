// Importadores de los trozos diferidos que se piden desde más de un sitio. Viven en el JS inicial (los usa el router):
// así otra pantalla diferida (Cuenta) los reutiliza sin repetir la lista de dependencias que Vite precarga con cada import().
export const suscripcionScreen = () => import("./screens/suscripcion");
