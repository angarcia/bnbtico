"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CURRENCY_COOKIE, parseCurrency } from "@/lib/currency";
import { safeNext } from "@/lib/safe-next";

/** Cambia la moneda de visualización y vuelve a la misma página. */
export async function setCurrencyAction(fd: FormData): Promise<void> {
  const currency = parseCurrency(String(fd.get("currency") ?? ""));
  const store = await cookies();
  store.set(CURRENCY_COOKIE, currency, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect(safeNext(String(fd.get("next") ?? "")) ?? "/explorar");
}
