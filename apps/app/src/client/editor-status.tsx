import { RouterButtonLink } from "./router-buttons";

export function SkeletonCard() {
  return (
    <section className="card skeleton owner-skeleton" aria-busy="true" aria-label="Cargando sus casas">
      <span className="sk thumb" />
      <span className="sk sk-line" />
    </section>
  );
}

export function NotFoundCard() {
  return (
    <section className="card stack gap-12">
      <h3>No encontramos esta casa</h3>
      <p className="small muted">Puede que la haya descartado o que el enlace no sea suyo.</p>
      <RouterButtonLink to="/propietario/casas" variant="primary">
        Ir a Mis casas
      </RouterButtonLink>
    </section>
  );
}
