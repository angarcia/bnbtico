"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { I } from "./icons";
import type { Role } from "@/lib/auth/types";

const GUEST = [
  { href: "/explorar", label: "Explorar", icon: I.search },
  { href: "/favoritos", label: "Favoritos", icon: I.heart },
  { href: "/cuenta", label: "Mi cuenta", icon: I.user },
];
const OWNER = [
  { href: "/propietario", label: "Inicio", icon: I.home },
  { href: "/propietario/casas", label: "Mis casas", icon: I.pin },
  { href: "/propietario/calendario", label: "Calendario", icon: I.calendar },
  { href: "/propietario/consultas", label: "Mis consultas", icon: I.chat },
  { href: "/cuenta", label: "Cuenta", icon: I.user },
];

export function BottomNav({ role }: { role: Role }) {
  const path = usePathname();
  const items = role === "owner" ? OWNER : GUEST;
  return (
    <nav className="tabbar" aria-label="Secciones">
      {items.map(({ href, label, icon: Icon }) => {
        const active = path === href || (href !== "/propietario" && path.startsWith(href + "/")) || (href === "/propietario" && path === "/propietario");
        return (
          <Link key={href} href={href} className="nav" aria-current={active ? "page" : undefined}>
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
