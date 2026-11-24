import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { AirbnbSummary } from "../../../domain/airbnb";
import type { OwnerIcalExport } from "../../../domain/ical-export";
import { toast } from "../../../shared/toast";
import { airbnbQuery, icalExportApi, useCalendarOnline } from "./airbnb-queries";
import { sessionState } from "../../comun/session";
import { ConfirmSheet } from "../../comun/confirm-sheet";
import { Field, TextArea } from "../../../shared/ui/field";
import { Button, TextButton } from "../../../shared/ui/button";
import { Notice } from "../../../shared/ui/structure";
import { Card } from "../../../shared/ui/card";
import * as EXPORT_COPY from "./copy/ical-export";

/** El token solo vive en este componente, nunca en Query, almacenamiento o telemetría. */
export function IcalExportCard({ id, userId, inlineConfirmation = false }: { id: string; userId: string; inlineConfirmation?: boolean }) {
  const client = useQueryClient();
  const online = useCalendarOnline();
  const [data, setData] = useState<OwnerIcalExport | null>(null);
  const [busy, setBusy] = useState<"loading" | "generating" | "revoking" | null>("loading");
  const [problem, setProblem] = useState<string | null>(null);
  const [copyProblem, setCopyProblem] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [confirmGeneration, setConfirmGeneration] = useState<number | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);
  const alive = useRef(true);
  const field = useRef<HTMLTextAreaElement>(null);
  const copying = useRef(false);
  const revoking = useRef(false);
  const url = data?.token ? new URL(`/ical/${data.token}.ics`, window.location.origin).href : "";

  function rememberPresence(result: OwnerIcalExport) {
    client.setQueryData<AirbnbSummary>(airbnbQuery(userId, id).queryKey, current => current ? { ...current, exportGenerated: result.generated } : current);
  }

  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    setBusy("loading");
    setProblem(null);
    void (async () => {
      try {
        const result = await (await icalExportApi()).overview(id);
        if (cancelled || sessionState().session?.userId !== userId) return;
        setData(result);
        client.setQueryData<AirbnbSummary>(airbnbQuery(userId, id).queryKey, current => current ? { ...current, exportGenerated: result.generated } : current);
      } catch {
        if (!cancelled && sessionState().session?.userId === userId) setProblem(EXPORT_COPY.readFailed);
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => { cancelled = true; alive.current = false; };
  }, [client, id, userId, attempt]);

  async function generate() {
    if (busy || !online) return;
    setBusy("generating");
    setProblem(null);
    try {
      const result = await (await icalExportApi()).generate(id);
      if (!alive.current || sessionState().session?.userId !== userId) return;
      setData(result);
      rememberPresence(result);
    } catch {
      if (alive.current && sessionState().session?.userId === userId) setProblem(EXPORT_COPY.generateFailed);
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  async function copy() {
    if (!url || copying.current) return;
    copying.current = true;
    setCopyProblem(false);
    try {
      await navigator.clipboard.writeText(url);
      if (alive.current && sessionState().session?.userId === userId) toast(EXPORT_COPY.copied);
    } catch {
      if (alive.current && sessionState().session?.userId === userId) {
        setCopyProblem(true);
        field.current?.focus();
        field.current?.select();
      }
    } finally { copying.current = false; }
  }

  async function revoke() {
    if (revoking.current || confirmGeneration === null || !online) return;
    revoking.current = true; setBusy("revoking"); setRevokeError(null);
    const current = () => alive.current && sessionState().session?.userId === userId;
    async function reconcile() {
      const result = await (await icalExportApi()).overview(id);
      if (current()) { setData(result); rememberPresence(result); }
      return result;
    }
    function confirmed() {
      setConfirmGeneration(null); setRevoked(true); setCopyProblem(false);
      toast(EXPORT_COPY.revokedToast);
    }
    try {
      await (await icalExportApi()).revoke(id, confirmGeneration);
      if (!current()) return;
      setData(previous => previous?.generation === confirmGeneration ? { ...previous, generated: false, token: null } : previous);
      const result = await reconcile();
      if (!current()) return;
      if (result.generated) throw new Error("El enlace cambió.");
      confirmed();
    } catch {
      if (!current()) return;
      const result = await reconcile().catch(() => null);
      if (!current()) return;
      if (result && !result.generated) confirmed();
      else setRevokeError(result?.generation !== undefined && result.generation !== confirmGeneration
        ? EXPORT_COPY.changedMeanwhile
        : EXPORT_COPY.revokeFailed);
    } finally { revoking.current = false; if (current()) setBusy(null); }
  }

  return <Card layout="stack" gap={16} aria-labelledby="ical-export-title" aria-busy={!!busy}>
    <h2 id="ical-export-title">{EXPORT_COPY.title}</h2>
    <p>{EXPORT_COPY.text}</p>
    {busy === "loading" ? <p role="status">{EXPORT_COPY.loading}</p> : null}
    {!online ? <Notice small>{EXPORT_COPY.offline}</Notice> : null}
    {problem ? <p className="field-error" role="alert">{problem}</p> : null}
    {revoked ? <Notice small>{EXPORT_COPY.revoked}</Notice> : null}
    {!data && !busy ? <Button variant="secondary" size="lg" disabled={!online} onClick={() => setAttempt(n => n + 1)}>{EXPORT_COPY.retry}</Button> : null}
    {data?.suspended ? <Notice>{EXPORT_COPY.suspended}</Notice> : null}
    {data && !data.generated && !data.suspended ? <>
      <p>{EXPORT_COPY.noLink}</p>
      <Button variant="primary" size="lg" disabled={!!busy || !online} onClick={() => void generate()}>{EXPORT_COPY.generate({ busy: busy === "generating" })}</Button>
    </> : null}
    {url ? <>
      <Field id="ical-export-url" label={EXPORT_COPY.linkLabel} describedBy="ical-export-help ical-export-copy-error">
        {(control) => <TextArea {...control} ref={field} rows={3} readOnly value={url} autoComplete="off" spellCheck={false} />}
      </Field>
      <Button variant="primary" size="lg" onClick={() => void copy()}>{EXPORT_COPY.copy}</Button>
      <p id="ical-export-copy-error" className="field-error" role={copyProblem ? "alert" : undefined}>{copyProblem ? EXPORT_COPY.copyFailed : null}</p>
      <p id="ical-export-help" className="hint">{EXPORT_COPY.help}</p>
      {data?.nights === 0 ? <p className="small muted">{EXPORT_COPY.noNights}</p> : null}
      <p className="small">{EXPORT_COPY.steps}</p>
      <p className="hint">{EXPORT_COPY.pace}</p>
    </> : null}
    {data?.generated && typeof data.generation === "number" && !(inlineConfirmation && confirmGeneration !== null) ? <TextButton tone="quiet" placement="sub-stop" disabled={!!busy || !online} onClick={() => { setRevokeError(null); setConfirmGeneration(data.generation ?? null); }}>{EXPORT_COPY.revoke}</TextButton> : null}
    {confirmGeneration !== null && inlineConfirmation ? (
      <div className="stack gap-8">
        <p>{EXPORT_COPY.revokeInline}</p>
        {revokeError && <p className="field-error" role="alert">{revokeError}</p>}
        <Button variant="danger" disabled={busy === "revoking" || !online} onClick={() => void revoke()}>
          {EXPORT_COPY.revoking({ busy: busy === "revoking" })}
        </Button>
        <Button variant="secondary" disabled={busy === "revoking"} onClick={() => setConfirmGeneration(null)}>{EXPORT_COPY.cancel}</Button>
      </div>
    ) : confirmGeneration !== null ? <ConfirmSheet title={EXPORT_COPY.revokeTitle} body={EXPORT_COPY.revokeText}
      confirmLabel={EXPORT_COPY.revoking({ busy: busy === "revoking" })} tone="destructive"
      pending={busy === "revoking"} error={revokeError} onClose={() => setConfirmGeneration(null)} onConfirm={() => void revoke()} /> : null}
  </Card>;
}
