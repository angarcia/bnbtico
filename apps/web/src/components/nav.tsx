"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { I } from "./icons";
import type { Role } from "@/lib/auth/types";

// Barra inferior plana del diseño v1: icono 22 px + etiqueta; activa en terracota. Cliente 3 pestañas, propietario 5.
const GUEST = [
  { href: "/explorar", label: "Explorar", icon: I.search },
  { href: "/favoritos", label: "Favoritos", icon: I.heart },
  { href: "/cuenta", label: "Mi cuenta", icon: I.user },
];
const OWNER = [
  { href: "/propietario", label: "Inicio", icon: I.home },
  { href: "/propietario/casas", label: "Mis casas", icon: I.house },
  { href: "/propietario/calendario", label: "Calendario", icon: I.calendar },
  { href: "/propietario/consultas", label: "Consultas", icon: I.chat },
  { href: "/cuenta", label: "Cuenta", icon: I.user },
];

export function BottomNav({ role, badge }: { role: Role; badge?: number }) {
  const path = usePathname();
  const items = role === "owner" ? OWNER : GUEST;
  return (
    <nav className={`tabbar${items.length === 3 ? " three" : ""}`} aria-label="Navegación principal">
      {items.map(({ href, label, icon: Icon }) => {
        const active = path === href || (href !== "/propietario" && path.startsWith(href + "/")) || (href === "/cuenta" && path.startsWith("/cuenta"));
        return (
          <Link key={href} href={href} className="nav" aria-current={active ? "page" : undefined}>
            <Icon size={22} />
            <span>{label}</span>
            {href === "/propietario/consultas" && badge ? <span className="count-badge">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
