// fetch para supabase-js (`global.fetch`): las escrituras a PostgREST (update, insert, delete y RPC) salen con
// `keepalive`, así que un paso guardado justo antes de que la app pase a segundo plano o se cierre llega igual a la base.
// El navegador limita los cuerpos keepalive a 64 KB en vuelo y no admite streams: solo se marca un cuerpo de texto corto.
const WRITE = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const MAX_BODY = 60_000;

export function keepaliveFetch(base: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  return (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body;
    const small = body === undefined || body === null || (typeof body === "string" && body.length <= MAX_BODY);
    if (init && WRITE.has(method) && url.includes("/rest/v1/") && small) return base(input, { ...init, keepalive: true });
    return base(input, init);
  };
}
