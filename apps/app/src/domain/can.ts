// Qué puede hacer el propietario con una casa según su estado. Refleja las reglas de SQL (trigger listings_protect,
// política listings_owner_delete y RPC submit_listing); la base sigue siendo quien decide.
import type { Listing } from "./listing";

export type ListingAction = "edit" | "discard" | "submit" | "reopen";

export function can(l: Pick<Listing, "status" | "reviewedAt">, action: ListingAction): boolean {
  switch (action) {
    case "edit":
    case "submit":
      return l.status === "draft" || l.status === "changes";
    case "discard":
      return l.status === "draft" && l.reviewedAt === null;
    case "reopen":
      return l.status === "active" || l.status === "changes" || l.status === "rejected";
  }
}
