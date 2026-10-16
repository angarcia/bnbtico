import Image from "next/image";
import Link from "next/link";
import logo from "../../public/bnbtico-original.png";
import { BottomNav } from "./nav";
import type { Role } from "@/lib/auth/types";

export function Shell({ role, children }: { role: Role; children: React.ReactNode }) {
  return (
    <div className="app">
      <header className="topbar">
        <Link href={role === "owner" ? "/propietario" : "/explorar"} className="brand" aria-label="bnbtico, inicio">
          <span className="brand-logo" aria-hidden="true"><Image src={logo} alt="" priority /></span>
        </Link>
      </header>
      <main className="view">{children}</main>
      <BottomNav role={role} />
    </div>
  );
}

export function ScreenTitle({ title, back, right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <div className="row between" style={{ flexWrap: "wrap" }}>
      <div className="row">
        {back ? (
          <Link href={back} aria-label="Volver" className="back">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 5-7 7 7 7" /></svg>
          </Link>
        ) : null}
        <h2 style={{ fontSize: 22 }}>{title}</h2>
      </div>
      {right}
    </div>
  );
}
