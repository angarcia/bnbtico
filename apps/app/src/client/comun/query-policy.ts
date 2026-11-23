/** Claves de consultas privadas (cuenta, casas y su actividad, consultas, calendario y suscripción del propietario, cola del admin): solo se persisten con sesión y se borran al cerrarla. */
export const PERSISTED_PRIVATE_KEYS = new Set(["account", "inquiries", "own-listings", "own-listing", "own-resumable", "own-stats", "own-activity", "calendar", "airbnb", "billing", "admin-queue", "admin-listing"]);

export const PRIVATE_QUERY_KEYS = new Set([...PERSISTED_PRIVATE_KEYS, "admin-houses", "admin-edits", "admin-edit", "admin-drafts"]);
