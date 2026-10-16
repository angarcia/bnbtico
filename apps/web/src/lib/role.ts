import "server-only";
import { cookies } from "next/headers";
import type { Role } from "@/lib/auth/types";

const ROLE = "bnbtico_role";

export async function currentRole(): Promise<Role> {
  const store = await cookies();
  return store.get(ROLE)?.value === "owner" ? "owner" : "guest";
}

export async function setRole(role: Role) {
  const store = await cookies();
  store.set(ROLE, role, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}

export async function clearRole() {
  const store = await cookies();
  store.delete(ROLE);
}
