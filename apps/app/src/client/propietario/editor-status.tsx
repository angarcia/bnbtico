import { RouterButtonLink } from "../comun/router-buttons";
import { EmptyState } from "../../shared/ui/structure";
import * as OWNER_COPY from "./copy/owner";

export function NotFoundCard() {
  return (
    <EmptyState
      gap={12}
      title={OWNER_COPY.notFoundTitle}
      text={<p className="small muted">{OWNER_COPY.notFoundText}</p>}
      action={<RouterButtonLink to="/propietario/casas" variant="primary">{OWNER_COPY.toMyHouses}</RouterButtonLink>}
    />
  );
}
