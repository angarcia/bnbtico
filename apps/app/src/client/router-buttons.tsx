// Los botones comunes (shared/button.tsx) sobre `Link` de TanStack Router: mismo aspecto y API, con `to`, `params` y `search`
// tipados. Van aparte porque shared/ no importa el router (la ficha SSR no lo lleva).
import { createLink } from "@tanstack/react-router";
import { ButtonLink, IconButtonLink, TextButtonLink } from "../shared/button";

export const RouterButtonLink = createLink(ButtonLink);
export const RouterTextLink = createLink(TextButtonLink);
export const RouterIconLink = createLink(IconButtonLink);
