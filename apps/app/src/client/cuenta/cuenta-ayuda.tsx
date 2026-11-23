import { ScreenHeader } from "../comun/screen-header";
import { useListingsCount } from "../comun/own-listings-query";
import { SUPPORT, waLink } from "./support";
import { Button, ButtonLink, WaIcon } from "../../shared/ui/button";
import { Field, TextInput } from "../../shared/ui/field";
import { RouterButtonLink } from "../comun/router-buttons";
import { Card } from "../../shared/ui/card";
import * as ACCOUNT_COPY from "./copy/account";

// ---------- /cuenta/recuperar ----------
export function RecuperarScreen() {
  return (
    <>
      <ScreenHeader kind="flow" title={ACCOUNT_COPY.recoverTitle} back={{ to: "/cuenta", historyBack: true }} />
      <Card layout="stack" gap={14}>
        <p>{ACCOUNT_COPY.recoverText}</p>
        <Field id="recovery-email" label={ACCOUNT_COPY.recoverEmail}>
          {(control) => <TextInput {...control} type="email" placeholder={ACCOUNT_COPY.emailPlaceholder} disabled />}
        </Field>
        <Button variant="primary" size="lg" disabled>
          {ACCOUNT_COPY.recoverButton}
        </Button>
        <p className="xs muted">{ACCOUNT_COPY.recoverNote}</p>
      </Card>
      <Card layout="stack">
        <h3>{ACCOUNT_COPY.noEmailTitle}</h3>
        <p className="small">{ACCOUNT_COPY.noEmailText}</p>
        <RouterButtonLink to="/ayuda" variant="secondary" size="xl" block icon={<WaIcon />}>
          {ACCOUNT_COPY.writeTo3bstays}
        </RouterButtonLink>
      </Card>
    </>
  );
}

// ---------- /ayuda ----------
export function AyudaScreen() {
  const s = SUPPORT[(useListingsCount().count ?? 0) > 0 ? "owner" : "guest"];
  return (
    <>
      <ScreenHeader kind="flow" title={ACCOUNT_COPY.helpTitle} back={{ to: "/cuenta", historyBack: true }} />
      <Card layout="stack" gap={14}>
        <span className="eyebrow">{s.label}</span>
        <p>{s.intro}</p>
        {s.number ? (
          <>
            <p className="small muted">
              {ACCOUNT_COPY.channel({ number: <span key="number" className="num">{s.number}</span>, other: s.other })}
            </p>
            <ButtonLink variant="secondary" size="xl" block icon={<WaIcon />} href={waLink(s.number, s.greeting)} target="_blank" rel="noopener">
              {ACCOUNT_COPY.openWhatsapp}
            </ButtonLink>
          </>
        ) : (
          <>
            <p className="small muted">{ACCOUNT_COPY.noNumber({ other: s.other })}</p>
            <Button variant="secondary" size="xl" block icon={<WaIcon />} disabled>
              {ACCOUNT_COPY.openWhatsapp}
            </Button>
          </>
        )}
      </Card>
    </>
  );
}
