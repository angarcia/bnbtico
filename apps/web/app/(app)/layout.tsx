import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { currentRole } from "@/lib/role";
import { appEnabled } from "@/lib/stage";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!appEnabled()) redirect("/");
  const role = await currentRole();
  return <Shell role={role}>{children}</Shell>;
}
