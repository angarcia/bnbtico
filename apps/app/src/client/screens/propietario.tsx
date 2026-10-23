// Zona del propietario: marcadores hasta el ticket 06 (Inicio, Mis casas, Calendario, Consultas).
import { Placeholder } from "../chrome";

export const InicioScreen = () => <Placeholder title="Inicio" home="/propietario" text="Aquí verá su casa, cómo compartirla y la oferta de lanzamiento. Muy pronto podrá publicarla desde aquí." />;
export const CasasScreen = () => <Placeholder title="Mis casas" home="/propietario" text="Aquí verá sus casas y en qué estado está cada una." />;
export const CalendarioScreen = () => <Placeholder title="Calendario" home="/propietario" text="Marque las noches ocupadas y los precios por fecha. Llega más adelante." />;
export const ConsultasScreen = () => <Placeholder title="Consultas" home="/propietario" text="Los clientes que le escriban por WhatsApp desde su ficha aparecerán aquí. Llega más adelante." />;
