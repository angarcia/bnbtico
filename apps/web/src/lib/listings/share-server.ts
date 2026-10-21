// Origen para los enlaces compartidos, calculado una sola vez desde la petición (servidor).
import "server-only";
import { headers } from "next/headers";
import { shareBase } from "./share";

export async function requestShareBase(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const origin = host ? `${h.get("x-forwarded-proto") ?? "http"}://${host}` : null;
  return shareBase({ NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_STAGE: process.env.NEXT_PUBLIC_STAGE }, origin);
}
