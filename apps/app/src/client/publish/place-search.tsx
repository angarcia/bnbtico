// Combobox de lugares del paso 2 (ubicación por punto): el buscador sobre el mapa y el de «Otra…». Muestra primero lo
// local (las zonas de la tabla `zones`), luego lo que responde Photon (OpenStreetMap) 300 ms después de la última tecla
// (la petición anterior se cancela) y, si se pide, un último elemento fijo («Usar "…"»). Flechas, Enter y Escape; Enter
// nunca envía el paso (sin nada marcado, elige el último elemento fijo; lo marcado se borra cuando llega Photon). Elegir
// cierra la lista y el teclado. Si Photon no responde, lo local y el último elemento siguen.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { LatLng } from "../../domain/geo";
import { parsePhotonNear, photonNearUrl, sameName, ZONE_DEBOUNCE_MS } from "../../domain/place-search";

export interface PlaceItem {
  key: string;
  /** Lo que se elige (y queda escrito en el campo). */
  name: string;
  /** Contexto para distinguir homónimos («Talamanca, Limón»); vacío si no hay. */
  detail: string;
  point: LatLng | null;
  /** Lo que se ve en la lista, si no es el nombre (p. ej. «Usar "…"»). */
  label?: string;
}

export interface PlaceSearchProps {
  label: string;
  placeholder: string;
  /** Lo propio, sin red (las zonas de la lista), para el texto escrito (también vacío, al enfocar). */
  local(text: string): PlaceItem[];
  /** Hacia dónde sesgar Photon; con `withinM`, el centro del rectángulo y del radio en que se busca. */
  near(): LatLng;
  withinM?: number;
  /** Último elemento fijo, después de Photon. */
  extra?(text: string): PlaceItem | null;
  onChoose(item: PlaceItem): void;
  autoFocus?: boolean;
}

export function PlaceSearch(props: PlaceSearchProps) {
  const [value, setValue] = useState("");
  const [found, setFound] = useState<PlaceItem[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inFlight = useRef<AbortController | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const listId = useId();

  const stop = () => {
    clearTimeout(timer.current);
    inFlight.current?.abort();
  };
  useEffect(() => {
    if (props.autoFocus) input.current?.focus();
    return stop;
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const local = props.local(value);
  const extra = props.extra?.(value) ?? null;
  const items = [...local, ...found.filter((f) => !local.some((l) => sameName(l.name, f.name))), ...(extra ? [extra] : [])];
  const shown = open && items.length > 0;

  function search(text: string) {
    stop();
    setFound([]);
    const { near, withinM } = latest.current;
    const center = near();
    const url = photonNearUrl(text, center, withinM);
    if (!url) return;
    timer.current = setTimeout(() => {
      const controller = new AbortController();
      inFlight.current = controller;
      fetch(url, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((json: unknown) => {
          if (controller.signal.aborted) return;
          setActive(-1); // la lista cambia bajo lo marcado: nada queda marcado por sorpresa
          setFound(parsePhotonNear(json, center, withinM).map((p) => ({ key: p.name + p.detail, name: p.name, detail: p.detail, point: { lat: p.lat, lng: p.lng } })));
        })
        .catch(() => undefined); // sin red o Photon caído: quedan lo local y el último elemento
    }, ZONE_DEBOUNCE_MS);
  }

  function choose(item: PlaceItem) {
    stop();
    setValue(item.name);
    setFound([]);
    setOpen(false);
    setActive(-1);
    input.current?.blur(); // cierra el teclado
    latest.current.onChoose(item);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // Ni envía el paso ni salta al campo siguiente: elige la sugerencia marcada o, sin ninguna, el último elemento fijo.
      e.preventDefault();
      e.stopPropagation();
      const pick = shown && active >= 0 ? items[active] : extra;
      if (pick) choose(pick);
      return;
    }
    if (!shown) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + items.length) % items.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="place-search">
      <input
        ref={input}
        value={value}
        autoComplete="off"
        placeholder={props.placeholder}
        aria-label={props.label}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setValue(e.currentTarget.value);
          setActive(-1);
          setOpen(true);
          search(e.currentTarget.value);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {/* Tocar dentro (una sugerencia o el enlace de OpenStreetMap) no quita el foco al campo: la lista no se cierra bajo el dedo. */}
      <div className="zone-pop" hidden={!shown} onMouseDown={(e) => e.preventDefault()}>
        <ul id={listId} role="listbox" aria-label={props.label} className="zone-options">
          {items.map((item, i) => (
            <li key={item.key} id={`${listId}-${i}`} role="option" aria-selected={i === active} onClick={() => choose(item)}>
              <b>{item.label ?? item.name}</b>
              {item.detail ? <span className="xs muted">{item.detail}</span> : null}
            </li>
          ))}
        </ul>
        {/* Datos de OpenStreetMap (ODbL), también los de Photon: la atribución va donde se muestran. */}
        <p className="zone-credit">
          Datos ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
            OpenStreetMap
          </a>{" "}
          · Photon
        </p>
      </div>
    </div>
  );
}
