import { ICAL_MAX_BYTES, IcalError, parseAirbnbCalendar, validateAirbnbUrl, type ImportedBlock } from "../domain/ical";

export interface IcalDownloadDeps {
  fetch: typeof fetch;
  /** Inyección para pruebas; los endpoints reales usan los límites predeterminados. */
  timeoutMs?: number;
  maxBytes?: number;
}

export async function readAirbnbCalendar(raw: string, deps: IcalDownloadDeps): Promise<ImportedBlock[]> {
  const url = validateAirbnbUrl(raw);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new IcalError("timeout")); }, deps.timeoutMs ?? 10_000);
  });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const maxBytes = Math.min(deps.maxBytes ?? ICAL_MAX_BYTES, ICAL_MAX_BYTES);
  async function read() {
    const response = await deps.fetch(url, { redirect: "manual", signal: controller.signal, headers: { accept: "text/calendar" } });
    if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); throw new IcalError("timeout"); }
    if (response.status !== 200 || response.redirected || !response.body) {
      await response.body?.cancel();
      throw new IcalError("download");
    }
    const declared = response.headers.get("content-length");
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
      await response.body.cancel();
      throw new IcalError("size");
    }
    reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let text = "";
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new IcalError("size");
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    if (controller.signal.aborted) throw new IcalError("timeout");
    return parseAirbnbCalendar(text);
  }
  try {
    return await Promise.race([read(), deadline]);
  } catch (error) {
    if (controller.signal.aborted) throw new IcalError("timeout");
    if (error instanceof IcalError) throw error;
    // fetch/decoder pueden incluir URL o contenido privado: no propagar message ni cause.
    throw new IcalError("download");
  } finally {
    clearTimeout(timer);
    // No prolongar el plazo por un transporte cuya cancelación también quede pendiente.
    if (reader) {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}
