// URL pública de una foto en el bucket `listings` (lectura pública; escritura solo del dueño por RLS).
export const PHOTO_BUCKET = "listings";

export function photoUrl(path: string, base: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string {
  const origin = base ? new URL(base).origin : "";
  return `${origin}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}
