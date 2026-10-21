"use client";
import { useState } from "react";
import { cantonesDe } from "@/lib/listings/cantones";
import { PROVINCES } from "@/lib/listings/schema";

/** Pantalla 2: provincia y cantón de lista (el cantón depende de la provincia; cambiarla lo vacía) y zona en texto libre. */
export function PlaceFields({ province: initialProvince, canton: initialCanton, zone }: { province: string; canton: string; zone: string }) {
  const [province, setProvince] = useState(initialProvince);
  const [canton, setCanton] = useState(cantonesDe(initialProvince).includes(initialCanton) ? initialCanton : "");
  return (
    <>
      <div className="field">
        <label htmlFor="pub-province">Provincia</label>
        <select id="pub-province" name="province" value={province} onChange={(e) => { setProvince(e.currentTarget.value); setCanton(""); }}>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="pub-canton">Cantón</label>
        <select id="pub-canton" name="canton" value={canton} onChange={(e) => setCanton(e.currentTarget.value)}>
          <option value="">Seleccione el cantón</option>
          {cantonesDe(province).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="pub-zone">Zona, playa o barrio</label>
        <input id="pub-zone" name="zone" maxLength={120} defaultValue={zone} autoComplete="off" placeholder="Playa Negra, Puerto Viejo" />
      </div>
    </>
  );
}
