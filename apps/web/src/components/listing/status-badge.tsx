import { STATUS_LABELS, type ListingStatus } from "@/lib/listings/schema";

/** Estado de la casa como lo ve el propietario. Activa pero «No disponible» se muestra aparte. */
export function StatusBadge({ status, available = true }: { status: ListingStatus; available?: boolean }) {
  if (status === "active" && !available) return <span className="badge badge-mute">No disponible</span>;
  const s = STATUS_LABELS[status];
  return <span className={`badge ${s.badge}`}>{s.label}</span>;
}
