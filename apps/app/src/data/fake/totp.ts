// TOTP (RFC 6238: HMAC-SHA1, 30 s, 6 dígitos) del fake, con Web Crypto. Como GoTrue, acepta el paso anterior y el siguiente.
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_MS = 30_000;

function decode(secret: string): Uint8Array {
  let bits = "";
  for (const c of secret.toUpperCase().replace(/[^A-Z2-7]/g, "")) bits += BASE32.indexOf(c).toString(2).padStart(5, "0");
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return bytes;
}

/** Secreto nuevo de 20 bytes en base32 (32 caracteres, como los de GoTrue). */
export function newTotpSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

export async function totpAt(secret: string, now: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", decode(secret) as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const counter = new DataView(new ArrayBuffer(8));
  counter.setBigUint64(0, BigInt(Math.floor(now / STEP_MS)));
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter.buffer));
  const offset = mac[mac.length - 1]! & 0x0f;
  const value = (new DataView(mac.buffer).getUint32(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}

export async function totpMatches(secret: string, code: string, now: number): Promise<boolean> {
  for (const skew of [-1, 0, 1]) if ((await totpAt(secret, now + skew * STEP_MS)) === code) return true;
  return false;
}
