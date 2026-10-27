// «Zona, playa o barrio» del paso 2 (ticket 22): sugerencias de Photon mientras se escribe, zonas frecuentes del Caribe
// sur para tocar sin escribir y texto libre («Otra»). Si Photon no responde, la lista y el texto libre siguen valiendo.
// El centro de la zona elegida se guarda solo en esta pestaña (zone-center.ts) para abrir el mapa del paso 3 con zoom.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { FREQUENT_ZONES, frequentZone, parsePhoton, photonUrl, ZONE_DEBOUNCE_MS, type ZoneOption } from "../../domain/zones";
import { rememberZone } from "./zone-center";

export function ZoneField({ listingId, province, canton, initial }: { listingId: string; province: string; canton: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [options, setOptions] = useState<ZoneOption[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inFlight = useRef<AbortController | null>(null);
  const listId = useId();
  const where = useRef({ province, canton });
  where.current = { province, canton };

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      inFlight.current?.abort();
    },
    [],
  );

  function search(text: string) {
    clearTimeout(timer.current);
    inFlight.current?.abort();
    inFlight.current = null;
    const url = photonUrl(text, where.current.province);
    if (!url) {
      setOptions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => {
      const controller = new AbortController();
      inFlight.current = controller;
      fetch(url, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((json: unknown) => {
          if (controller.signal.aborted) return;
          const found = parsePhoton(json, where.current);
          setOptions(found);
          setActive(-1);
          setOpen(found.length > 0 && document.activeElement === input.current);
        })
        .catch(() => {
          // Sin red o Photon caído: sin sugerencias; se escribe la zona tal cual.
          if (!controller.signal.aborted) setOptions([]);
        });
    }, ZONE_DEBOUNCE_MS);
  }

  function choose(zone: ZoneOption) {
    clearTimeout(timer.current);
    inFlight.current?.abort();
    setValue(zone.name);
    setOpen(false);
    setOptions([]);
    rememberZone(listingId, zone);
  }

  function other() {
    clearTimeout(timer.current);
    inFlight.current?.abort();
    setValue("");
    setOptions([]);
    rememberZone(listingId, null);
    input.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || options.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
    } else if (e.key === "Enter" && active >= 0) {
      // Elegir la sugerencia marcada no envía el paso; el siguiente Enter, sí.
      e.preventDefault();
      e.stopPropagation();
      choose(options[active]!);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const picked = frequentZone(value)?.name;
  return (
    <div className="field zone-field">
      <label htmlFor="pub-zone">Zona, playa o barrio</label>
      <div className="zone-combo">
        <input
          ref={input}
          id="pub-zone"
          name="zone"
          maxLength={120}
          value={value}
          autoComplete="off"
          placeholder="Playa Negra, Puerto Viejo"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            setValue(e.currentTarget.value);
            rememberZone(listingId, null);
            search(e.currentTarget.value);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => options.length > 0 && setOpen(true)}
          onBlur={() => setOpen(false)}
        />
        {/* Tocar dentro (una sugerencia o el enlace de OpenStreetMap) no quita el foco al campo: la lista no se cierra bajo el dedo. */}
        <div className="zone-pop" hidden={!open} onMouseDown={(e) => e.preventDefault()}>
        <ul id={listId} role="listbox" aria-label="Zonas sugeridas" className="zone-options">
          {options.map((z, i) => (
            <li
              key={`${z.name}|${z.detail}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onClick={() => choose(z)}
            >
              <b>{z.name}</b>
              <span className="xs muted">{z.detail}</span>
            </li>
          ))}
        </ul>
          {/* Datos de OpenStreetMap (ODbL) servidos por Photon: la atribución va donde se muestran. */}
          <p className="zone-credit">
            Datos ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
              OpenStreetMap
            </a>{" "}
            · Photon
          </p>
        </div>
      </div>
      <div className="chiprow zone-chips" role="group" aria-label="Zonas frecuentes">
        {FREQUENT_ZONES.map((z) => (
          <button key={z.name} type="button" className="chip chip-sm" aria-pressed={picked === z.name} onClick={() => choose(z)}>
            {z.name}
          </button>
        ))}
        <button type="button" className="chip chip-sm" onClick={other}>
          Otra
        </button>
      </div>
    </div>
  );
}
