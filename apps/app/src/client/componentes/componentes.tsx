// Catálogo vivo de componentes (estructura del frontend, paso 5): cada componente común de shared/ui en sus variantes y
// estados, en una sola página. Solo en local y en pruebas: en producción el worker responde 404 y el service worker no la
// sirve desde su caché (src/server/app.ts, src/sw/routes.ts). Trozo diferido propio; no entra en el JS inicial. Su prueba
// (tests/e2e/componentes.spec.ts) la recorre en móvil y escritorio y guarda las capturas.
import { useState, type ReactNode } from "react";
import { STATUS_TEXTS } from "../../domain/status-label";
import { Button, IconButton, TextButton, type ButtonSize, type ButtonVariant, type IconButtonTone, type TextButtonTone } from "../../shared/ui/button";
import { Card, type CardTone } from "../../shared/ui/card";
import { ChoiceChips, Segmented } from "../../shared/ui/choice";
import { ClosedField } from "../../shared/ui/closed-field";
import { AffixInput, Checkbox, Field, SearchInput, Select, TextArea, TextInput } from "../../shared/ui/field";
import { I } from "../../shared/ui/icons";
import { Dialog, Sheet } from "../../shared/ui/overlay";
import { CounterRow, Stepper } from "../../shared/ui/stepper";
import { CountBadge, EmptyState, LoadError, Notice, Skeleton, StatusTag, type NoticeTone, type SkeletonShape } from "../../shared/ui/structure";
import { CodeInput } from "../comun/code-input";
import { ConfirmSheet } from "../comun/confirm-sheet";
import { RouterButtonLink, RouterIconLink, RouterTextLink } from "../comun/router-buttons";
import { RouterCardLink, RouterListRow } from "../comun/router-rows";
import { ScreenHeader } from "../comun/screen-header";
import * as COPY from "./copy/componentes";

const VARIANTS: readonly ButtonVariant[] = ["primary", "secondary", "pay", "whatsapp", "danger"];
const SIZES: readonly ButtonSize[] = ["md", "lg", "xl"];
const TEXT_TONES: readonly TextButtonTone[] = ["link", "quiet", "danger"];
const ICON_TONES: readonly IconButtonTone[] = ["plain", "overlay", "float"];
const CARD_TONES: readonly CardTone[] = ["plain", "solid", "soft", "sun"];
const NOTICE_TONES: readonly NoticeTone[] = ["info", "solid", "sun", "review", "error"];
const SKELETONS: readonly SkeletonShape[] = ["row", "line", "avatar", "account", "subscription", "calendar", "grid"];

/** Una sección del catálogo: su título (para el índice de la prueba) y las piezas. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack gap-12" aria-label={title} data-testid="catalog-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function ComponentesScreen() {
  const [chips, setChips] = useState<string[]>(["wifi"]);
  const [currency, setCurrency] = useState<string>("crc");
  const [people, setPeople] = useState(2);
  const [bedrooms, setBedrooms] = useState(1);
  const [surface, setSurface] = useState<"sheet" | "dialog" | null>(null);
  const [confirm, setConfirm] = useState<"default" | "destructive" | "keep" | null>(null);
  const [code, setCode] = useState("12");
  const toggle = (value: string) => setChips((now) => (now.includes(value) ? now.filter((v) => v !== value) : [...now, value]));

  return (
    <main className="view no-nav">
      <div className="stack gap-24">
      <header className="stack gap-8">
        <h1>{COPY.title}</h1>
        <p className="muted">{COPY.intro}</p>
      </header>

      <Section title={COPY.buttons}>
        {VARIANTS.map((variant) => (
          <div key={variant} className="row wrap gap-8">
            {SIZES.map((size) => (
              <Button key={size} variant={variant} size={size} icon={variant === "whatsapp" ? <I.wa size={20} /> : undefined}>
                {COPY.buttonVariant({ variant, size })}
              </Button>
            ))}
            <Button variant={variant} pending>{COPY.pending}</Button>
            <Button variant={variant} disabled>{COPY.disabled}</Button>
          </div>
        ))}
        <Button variant="primary" size="lg" block>{COPY.block}</Button>
      </Section>

      <Section title={COPY.textButtons}>
        <div className="row wrap gap-12">
          {TEXT_TONES.map((tone) => <TextButton key={tone} tone={tone}>{COPY.textButton({ tone })}</TextButton>)}
        </div>
        <div className="row wrap gap-12">
          {ICON_TONES.map((tone) => (
            <IconButton key={tone} tone={tone} label={COPY.iconButton({ tone })}>
              <I.x size={20} />
            </IconButton>
          ))}
        </div>
      </Section>

      <Section title={COPY.cards}>
        {CARD_TONES.map((tone) => (
          <Card key={tone} tone={tone} layout="stack" gap={8}>
            <b>{COPY.cardTone({ tone })}</b>
            <span className="small">{COPY.cardBody}</span>
          </Card>
        ))}
        <Card layout="row" gap={12}>
          <I.house size={22} />
          <span>{COPY.cardRow}</span>
        </Card>
      </Section>

      <Section title={COPY.tags}>
        <div className="row wrap gap-8">
          {Object.entries(STATUS_TEXTS).map(([status, label]) => <StatusTag key={status} label={label} />)}
        </div>
        {/* El contador va sobre la esquina de su botón (Filtros, en Explorar). */}
        <span className="filters-btn" aria-hidden="true">
          <I.sliders size={20} />
          <CountBadge n={2} placement="filters" />
        </span>
      </Section>

      <Section title={COPY.notices}>
        {NOTICE_TONES.map((tone) => <Notice key={tone} tone={tone}>{COPY.notice({ tone })}</Notice>)}
        <Notice tone="sun" small action={<TextButton tone="link">{COPY.noticeAction}</TextButton>}>{COPY.notice({ tone: "small" })}</Notice>
        <LoadError onRetry={() => undefined} />
        <EmptyState title={COPY.emptyTitle} text={<p className="muted">{COPY.emptyText}</p>} action={<Button variant="primary">{COPY.emptyAction}</Button>} />
      </Section>

      <Section title={COPY.skeletons}>
        {SKELETONS.map((shape) => <Skeleton key={shape} shape={shape} label={COPY.skeleton({ shape })} count={2} />)}
      </Section>

      <Section title={COPY.fields}>
        <Field label={COPY.name} hint={COPY.nameHint}>
          {(control) => <TextInput {...control} placeholder={COPY.namePlaceholder} />}
        </Field>
        <Field label={COPY.price} error={COPY.priceError}>
          {(control) => <AffixInput {...control} prefix="₡" size="lg" inputMode="numeric" defaultValue="0" />}
        </Field>
        <Field label={COPY.description} count={{ text: COPY.descriptionCount }}>
          {(control) => <TextArea {...control} rows={3} />}
        </Field>
        <Field label={COPY.province} size="compact">
          {(control) => (
            <Select {...control}>
              {COPY.provinces.map((p) => <option key={p}>{p}</option>)}
            </Select>
          )}
        </Field>
        <Field label={COPY.search} labelHidden>
          {(control) => <SearchInput {...control} variant="field" placeholder={COPY.search} />}
        </Field>
        <Checkbox name="catalog-check" defaultChecked>{COPY.checkbox}</Checkbox>
      </Section>

      <Section title={COPY.choices}>
        <ChoiceChips as="input" type="checkbox" name="catalog-chips" label={COPY.chips} options={COPY.chipOptions} selected={chips} onToggle={toggle} />
        <Segmented label={COPY.segmented} options={COPY.segmentOptions} value={currency} onChange={setCurrency} />
        <Segmented label={COPY.segmented} options={COPY.segmentOptions} value={currency} onChange={setCurrency} fill />
        <p className="small muted">{COPY.choiceCardsNote}</p>
      </Section>

      <Section title={COPY.counters}>
        <Stepper unit="people" value={people} min={1} max={10} onChange={setPeople} />
        <CounterRow label={COPY.bedrooms} icon={<I.bed size={22} />} unit="bedrooms" value={bedrooms} min={0} max={6} onChange={setBedrooms} />
        <CounterRow label={COPY.people} icon={<I.users size={22} />} unit="people" value={0} min={0} max={10} empty onChange={() => undefined} />
      </Section>

      <Section title={COPY.closedFields}>
        <ClosedField kind="search" label={COPY.where} value={COPY.whereValue} icon={<I.pin size={20} />} />
        <ClosedField kind="picker" value={COPY.house} icon={<I.house size={20} />} />
        <p className="small muted">{COPY.datesInSheet}</p>
      </Section>

      <Section title={COPY.surfaces}>
        <div className="row wrap gap-8">
          <Button variant="secondary" onClick={() => setSurface("sheet")}>{COPY.openSheet}</Button>
          <Button variant="secondary" onClick={() => setSurface("dialog")}>{COPY.openDialog}</Button>
        </div>
        {surface === "sheet" ? (
          <Sheet title={COPY.sheetTitle} onClose={() => setSurface(null)} footer={<Button variant="primary" block onClick={() => setSurface(null)}>{COPY.close}</Button>}>
            <div className="stack gap-12">
              <p>{COPY.surfaceBody}</p>
              <div className="dates">
                <ClosedField kind="date" label={COPY.checkIn} value={COPY.checkInValue} />
                <ClosedField kind="date" label={COPY.checkOut} value={COPY.checkOutEmpty} empty />
              </div>
            </div>
          </Sheet>
        ) : null}
        {surface === "dialog" ? (
          <Dialog title={COPY.dialogTitle} onClose={() => setSurface(null)} footer={<Button variant="primary" onClick={() => setSurface(null)}>{COPY.close}</Button>}>
            <p>{COPY.surfaceBody}</p>
          </Dialog>
        ) : null}
      </Section>

      <Section title={COPY.headers}>
        <ScreenHeader kind="flow" title={COPY.headerFlow} back={{ to: "/_componentes" }} />
        <ScreenHeader kind="flow" title={COPY.headerFlowClose} close={{ onClick: () => undefined, label: COPY.close }} />
        <ScreenHeader kind="wizard" title={COPY.headerWizard} close={{ onClick: () => undefined, label: COPY.close }} />
      </Section>

      <Section title={COPY.routerLinks}>
        <div className="row wrap gap-8">
          <RouterButtonLink to="/_componentes" variant="primary">{COPY.routerButton}</RouterButtonLink>
          <RouterTextLink to="/_componentes" tone="link">{COPY.routerText}</RouterTextLink>
          <RouterIconLink to="/_componentes" label={COPY.routerIcon}><I.chevron size={20} /></RouterIconLink>
        </div>
        <RouterCardLink to="/_componentes" layout="row" gap={12}>
          <I.house size={22} />
          <span>{COPY.routerCard}</span>
        </RouterCardLink>
        <RouterListRow to="/_componentes">
          <span>{COPY.routerRow}</span>
          <I.chevron size={20} />
        </RouterListRow>
      </Section>

      <Section title={COPY.confirmations}>
        <div className="row wrap gap-8">
          <Button variant="secondary" onClick={() => setConfirm("default")}>{COPY.confirmDefault}</Button>
          <Button variant="danger" onClick={() => setConfirm("destructive")}>{COPY.confirmDestructive}</Button>
          <Button variant="secondary" onClick={() => setConfirm("keep")}>{COPY.confirmKeep}</Button>
        </div>
        {confirm ? (
          <ConfirmSheet tone={confirm} title={COPY.confirmTitle} body={COPY.confirmBody} confirmLabel={COPY.confirmLabel} onConfirm={() => setConfirm(null)} onClose={() => setConfirm(null)} />
        ) : null}
      </Section>

      <Section title={COPY.codeTitle}>
        <CodeInput id="catalog-code" value={code} onChange={setCode} error={null} />
        <CodeInput id="catalog-code-error" value="123" onChange={() => undefined} error={COPY.codeError} />
      </Section>

      <Section title={COPY.icons}>
        <div className="row wrap gap-12">
          {Object.entries(I).map(([key, Icon]) => (
            <span key={key} className="stack gap-0 center small muted" title={key}>
              <Icon size={24} />
              {key}
            </span>
          ))}
        </div>
      </Section>
      </div>
    </main>
  );
}
