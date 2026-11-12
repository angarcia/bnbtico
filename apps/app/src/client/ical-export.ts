import { authApi } from "./session";

export async function icalExportApi() {
  await authApi();
  return (await import("./supabase-data")).icalExportApi();
}
