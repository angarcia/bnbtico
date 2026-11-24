// Explorar en escritorio (revisión de escritorio 2026-11-13): la búsqueda con sus paneles Lugar, Fechas o Noches y Personas,
// y los chips de «Qué necesitan» con una zona elegida. En su propio trozo: el teléfono no los descarga (historia 07, paso 5).
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, useId, useRef, useState } from "react";
import { costaRicaToday } from "../../domain/dates";
import { peopleLabel, stayLabel } from "../../domain/search";
import { ALL_PROVINCES, SEARCH_MAX_PEOPLE, searchFor, type Filters } from "../../domain/filters";
import { FeatureChoiceLabel, FEATURE_CHOICE_NAME, FEATURE_CHOICE_ORDER } from "../../shared/feature-choices";
import { ChoiceChips } from "../../shared/ui/choice";
import { Stepper } from "../../shared/ui/stepper";
import { SEARCH_MODE } from "../../shared/flags";
import { I } from "../../shared/ui/icons";
import { loadedListings, zoneListingsQuery } from "./queries";
import { RangeCalendar } from "../../shared/range-calendar";
import { Button, TextButton } from "../../shared/ui/button";
import { useDismiss } from "../../shared/ui/dismiss";
import * as DESKTOP_COPY from "./copy/explore-desktop";

const ZonePicker = lazy(() => import("./buscar").then((m) => ({ default: m.Donde })));
// El contador de noches del panel (modo noches): diferido, como la zona; trozo nights-picker-*, que comparte con la búsqueda
// del teléfono y mide su propia entrada de .size-limit.json.
const NightsPicker = lazy(() => import("../../shared/nights-picker").then((m) => ({ default: m.NightsPicker })));

type SearchField = "donde" | "cuando";

export function DesktopSearch({ filters, zoneName }: { filters: Filters; zoneName: string | null }) {
  const navigate = useNavigate();
  const [panel, setPanel] = useState<SearchField | null>(null);
  const [draft, setDraft] = useState(filters);
  const [today] = useState(() => costaRicaToday(Date.now()));
  const group = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const focusZone = useRef(true);
  const panelId = useId();
  const displayed = panel ? draft : filters;
  const fields: { key: SearchField; label: string; value: string | null; icon: typeof I.pin }[] = [
    { key: "donde", label: "Lugar", value: filters.zone ? zoneName : filters.prov !== ALL_PROVINCES ? filters.prov : null, icon: I.pin },
    // Feature flags (#58): «Fechas» con fechas, «Noches» con número de noches (diseño #59), ninguno sin estancia.
    ...(SEARCH_MODE === "dates" ? [{ key: "cuando" as const, label: "Fechas", value: stayLabel(displayed), icon: I.calendar }] : []),
    ...(SEARCH_MODE === "nights" ? [{ key: "cuando" as const, label: "Noches", value: stayLabel(displayed), icon: I.moon }] : []),
  ];

  // Escape vuelve al disparador; tocar fuera solo cierra.
  const dismiss = useDismiss({
    open: !!panel,
    inside: () => [group.current],
    onDismiss(reason) {
      setPanel(null);
      if (reason === "escape") trigger.current?.focus();
    },
  });

  function apply(next: Filters) {
    setPanel(null);
    trigger.current?.focus();
    void navigate({ to: "/explorar", search: searchFor(next), resetScroll: false });
  }

  function changePeople(ppl: number) {
    setPanel(null);
    void navigate({ to: "/explorar", search: searchFor({ ...filters, ppl }), replace: true, resetScroll: false });
  }

  return (
    <div ref={group} className="desktop-search-fields" onKeyDown={dismiss.onKeyDown}>
      {fields.map(({ key, label, value, icon: Icon }) => (
        <div className="desktop-search-field" key={key}>
          <button type="button" className="search-pill float-card" aria-expanded={panel === key}
            aria-controls={panel === key ? panelId : undefined} aria-label={value ? `${label}: ${value}` : label}
            onClick={(event) => {
              trigger.current = event.currentTarget;
              focusZone.current = true;
              setDraft(filters);
              setPanel(panel === key ? null : key);
            }}>
            <Icon size={20} />
            <span className="search-pill-text">{value ?? label}</span>
          </button>
          {panel === key && (
            <section id={panelId} aria-label={label} className={`desktop-search-panel desktop-search-panel-${key === "cuando" && SEARCH_MODE === "nights" ? "noches" : key}`}>
              {key === "donde" ? (
                <Suspense fallback={<p role="status">{DESKTOP_COPY.loadingZones}</p>}>
                  <ZonePicker zone={draft.zone} onPick={(zone) => apply({ ...draft, zone })} onClear={() => apply({ ...draft, zone: null, prov: ALL_PROVINCES })} focusOnce={focusZone} />
                </Suspense>
              ) : SEARCH_MODE === "nights" ? (
                <>
                  <Suspense fallback={<p role="status">{DESKTOP_COPY.loading}</p>}>
                    <NightsPicker nights={draft.nights} onChange={(nights) => setDraft({ ...draft, nights })} />
                  </Suspense>
                  <div className="row between">
                    <TextButton tone="quiet" onClick={() => apply({ ...draft, nights: 0 })}>{DESKTOP_COPY.clearNights}</TextButton>
                    <Button variant="primary" disabled={!draft.nights} onClick={() => apply(draft)}>{DESKTOP_COPY.applyNights}</Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="desktop-search-calendar">
                    <RangeCalendar weekdaysPerMonth today={today} value={draft} onChange={(range) => setDraft({ ...draft, ...range })} />
                  </div>
                  <div className="row between">
                    <TextButton tone="quiet" onClick={() => apply({ ...draft, arrival: null, departure: null })}>{DESKTOP_COPY.clearDates}</TextButton>
                    <Button variant="primary" disabled={!draft.arrival || !draft.departure} onClick={() => apply(draft)}>{DESKTOP_COPY.applyDates}</Button>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      ))}
      <div className="desktop-search-people float-card" role="group" aria-label={DESKTOP_COPY.people}>
        <I.user size={20} />
        <Stepper unit="people" value={filters.ppl} min={0} max={SEARCH_MAX_PEOPLE} empty={!filters.ppl} valueLabel={peopleLabel(filters.ppl) ?? DESKTOP_COPY.peopleUnset} onChange={changePeople} />
      </div>
    </div>
  );
}


export function DesktopFeatureFilters({ filters }: { filters: Filters }) {
  const navigate = useNavigate();
  const { data } = useInfiniteQuery(zoneListingsQuery(filters.zone));
  const available = new Set(loadedListings(data)?.flatMap((listing) => listing.features));
  const choices = FEATURE_CHOICE_ORDER.filter((feature) => available.has(feature));
  if (!choices.length) return null;

  return (
    <ChoiceChips
      as="button"
      float
      placement="desktop-feature-filters"
      label={DESKTOP_COPY.needs}
      options={choices.map((feature) => ({ value: feature, name: FEATURE_CHOICE_NAME[feature], label: <FeatureChoiceLabel feature={feature} /> }))}
      selected={filters.features}
      onToggle={(feature) => {
        const features = filters.features.includes(feature) ? filters.features.filter((key) => key !== feature) : [...filters.features, feature];
        void navigate({ to: "/explorar", search: searchFor({ ...filters, features }), resetScroll: false });
      }}
    />
  );
}

