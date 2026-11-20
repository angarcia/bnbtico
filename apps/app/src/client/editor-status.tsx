import { RouterButtonLink } from "./router-buttons";
import { EmptyState } from "../shared/structure";

export function NotFoundCard() {
  return (
    <EmptyState
      gap={12}
      title="No encontramos esta casa"
      text={<p className="small muted">Puede que la haya descartado o que el enlace no sea suyo.</p>}
      action={<RouterButtonLink to="/propietario/casas" variant="primary">Ir a Mis casas</RouterButtonLink>}
    />
  );
}
