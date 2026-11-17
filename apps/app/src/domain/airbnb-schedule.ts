// Cada cuánto se leen los calendarios de Airbnb (decisión 2026-11-17): minutos de una lista cerrada, que el despliegue
// traduce al cron del worker (variables de GitHub AIRBNB_SYNC_MINUTES_PRUEBAS y AIRBNB_SYNC_MINUTES_PRODUCCION). La misma
// traducción vive en scripts/deploy-target.mjs (JavaScript sin compilar); tests/unit/airbnb-schedule.test.ts comprueba que
// las dos dan lo mismo.

export const AIRBNB_SYNC_MINUTES = [5, 10, 15, 30, 60, 120, 180, 240, 360, 720, 1440] as const;
export type AirbnbSyncMinutes = (typeof AIRBNB_SYNC_MINUTES)[number];
/** Sin variable: cada 3 horas, como hasta el 2026-11-17. */
export const DEFAULT_AIRBNB_SYNC_MINUTES: AirbnbSyncMinutes = 180;
/** El cron horario del worker (avisos y tareas diarias). Con 60 minutos, Airbnb comparte este cron. */
export const HOURLY_CRON = "17 * * * *";

const isSyncMinutes = (n: number): n is AirbnbSyncMinutes => (AIRBNB_SYNC_MINUTES as readonly number[]).includes(n);

/** Los minutos que trae el worker en AIRBNB_SYNC_MINUTES; ausentes o inválidos (en local), los de siempre. */
export function syncMinutesOf(raw: string | undefined): AirbnbSyncMinutes {
  const n = raw && /^\d+$/.test(raw) ? Number(raw) : NaN;
  return isSyncMinutes(n) ? n : DEFAULT_AIRBNB_SYNC_MINUTES;
}

/** Menos de una hora: cada N minutos en punto. Una hora o más: el minuto 17 de cada N horas (un día: 00:17 UTC). */
export function airbnbCron(minutes: AirbnbSyncMinutes): string {
  if (minutes < 60) return `*/${minutes} * * * *`;
  if (minutes === 1440) return "17 0 * * *";
  const hours = minutes / 60;
  return hours === 1 ? HOURLY_CRON : `17 */${hours} * * *`;
}

/** Si ese minuto (UTC, segundos a cero) es uno de los ciclos del intervalo. */
export function isAirbnbSlot(minutes: AirbnbSyncMinutes, slot: Date): boolean {
  if (slot.getUTCSeconds() !== 0 || slot.getUTCMilliseconds() !== 0) return false;
  if (minutes < 60) return slot.getUTCMinutes() % minutes === 0;
  return slot.getUTCMinutes() === 17 && slot.getUTCHours() % (minutes / 60) === 0;
}

/** Qué hace el worker con cada aviso del cron: con 60 minutos el horario hace también Airbnb. */
export function cronTasks(cron: string, minutes: AirbnbSyncMinutes): { airbnb: boolean; hourly: boolean } {
  return { airbnb: cron === airbnbCron(minutes), hourly: cron === HOURLY_CRON };
}
