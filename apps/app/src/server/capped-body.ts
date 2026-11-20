/**
 * Lee el cuerpo como texto hasta `max` bytes. Si lo pasa, cancela la lectura y devuelve `null`: el tope se aplica a lo
 * que llega, no a lo que declara Content-Length (que puede faltar o mentir). Historia #71.
 */
export async function readCapped(request: Request, max: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}
