import { NextResponse, type NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/auth/refresh";

// 1) pruebas.bnbtico.com pide contraseña (PREVIEW_PASSWORD). Sin variable, no hay barrera (local, producción).
//    Los iconos y el manifest de la PWA quedan fuera: el móvil los pide sin credenciales al añadir a la pantalla de inicio.
// 2) Refresca la sesión de Supabase en cada petición (ver src/lib/auth/refresh.ts).
const PUBLIC_ASSETS = new Set(["/manifest.webmanifest", "/favicon.ico", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"]);

export async function proxy(request: NextRequest) {
  if (PUBLIC_ASSETS.has(request.nextUrl.pathname)) return NextResponse.next();
  const password = process.env.PREVIEW_PASSWORD;
  if (password && !authorized(request, password)) {
    return new NextResponse("Acceso restringido", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="bnbtico pruebas", charset="UTF-8"' },
    });
  }
  const response = NextResponse.next({ request });
  await refreshSupabaseSession(request, response);
  return response;
}

function authorized(request: NextRequest, password: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  try {
    const decoded = atob(encoded);
    return decoded.slice(decoded.indexOf(":") + 1) === password;
  } catch {
    return false;
  }
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
